// api/chat.js — Vercel Serverless Function (прокси для всех моделей)
// v2: фиксы совета агентов 08.07.2026 — R1 reasoning_content, безопасный Gemini-парсер, OpenRouter.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { provider, model, messages, apiKey } = body || {};
    if (!provider || !apiKey) return res.status(400).json({ error: 'Нет provider или apiKey' });

    /* ---------- Gemini: свой формат + безопасный парсер (фикс B) ---------- */
    if (provider === 'gemini') {
      const contents = (messages || []).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const gr = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2000 } }) }
      );
      const gd = await gr.json();
      if (!gr.ok) return res.status(gr.status).json({ error: gd.error?.message || ('Gemini ошибка ' + gr.status) });

      const candidate = gd?.candidates?.[0];
      if (!candidate) {
        const blocked = gd?.promptFeedback?.blockReason;
        return res.status(502).json({ error: 'Gemini: нет кандидатов' + (blocked ? ' (блок: ' + blocked + ')' : '') });
      }
      const parts = candidate?.content?.parts;
      const text = Array.isArray(parts) ? parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('').trim() : '';
      if (text) return res.status(200).json({ content: text });
      // текста нет: если причина не STOP — это блок; если STOP без текста — редкий пустой ответ
      const reason = candidate?.finishReason || 'пустой ответ';
      if (reason === 'STOP') return res.status(200).json({ content: '(Gemini вернул пустой ответ, попробуй переформулировать)' });
      return res.status(502).json({ error: 'Gemini заблокировал ответ (' + reason + ')' });
    }

    /* ---------- OpenAI-совместимые провайдеры ---------- */
    const endpoints = {
      deepseek:   'https://api.deepseek.com/v1/chat/completions',
      grok:       'https://api.x.ai/v1/chat/completions',
      github:     'https://models.inference.ai.azure.com/chat/completions',
      groq:       'https://api.groq.com/openai/v1/chat/completions',
      cerebras:   'https://api.cerebras.ai/v1/chat/completions',
      mistral:    'https://api.mistral.ai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions'
    };
    const url = endpoints[provider];
    if (!url) return res.status(400).json({ error: 'Неизвестный провайдер: ' + provider });

    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://freex-xi.vercel.app';
      headers['X-Title'] = 'FreeX';
    }

    // R1 и reasoning-модели требуют больше токенов (фикс A)
    const isReasoning = /r1|reason/i.test(model || '');
    const maxTokens = isReasoning ? 4000 : (provider === 'github' ? 1500 : 2000);

    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens })
    });
    const d = await r.json();
    if (!r.ok) {
      // Grok 403: понятное сообщение (фикс C)
      if (provider === 'grok' && r.status === 403) {
        return res.status(403).json({ error: 'Grok (xAI): доступ закрыт — нужен платный баланс на console.x.ai. Бесплатно Grok доступен через OpenRouter.' });
      }
      return res.status(r.status).json({ error: d.error?.message || ('ошибка ' + r.status) });
    }

    /* Универсальный парсер ответа (фикс A: content -> reasoning_content -> <think>-разметка) */
    const msg = d?.choices?.[0]?.message || {};
    let text = (typeof msg.content === 'string' ? msg.content : '') || '';
    if (!text.trim() && typeof msg.reasoning_content === 'string') text = msg.reasoning_content;
    // Если ответ пришёл с <think>...</think> — показываем только финальную часть
    const thinkMatch = text.match(/<think>[\s\S]*?<\/think>([\s\S]*)/);
    if (thinkMatch && thinkMatch[1].trim()) text = thinkMatch[1].trim();
    text = (text || '').trim();

    if (!text) {
      const fr = d?.choices?.[0]?.finish_reason || 'unknown';
      return res.status(502).json({ error: 'Пустой ответ от ' + provider + ' (finish_reason: ' + fr + '). Попробуй ещё раз или короче вопрос.' });
    }
    return res.status(200).json({ content: text });

  } catch (e) {
    return res.status(500).json({ error: 'Прокси: ' + e.message });
  }
}
