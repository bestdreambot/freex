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
    const { provider, model, messages, account } = body || {};
    let { apiKey } = body || {};
    if (!provider) return res.status(400).json({ error: 'Нет provider' });

    if (provider === 'deepseek') {
      // Свой ключ пользователя приоритетнее серверного; иначе — переменная окружения.
      apiKey = apiKey || process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return res.status(400).json({ error: 'DeepSeek: нужен API-ключ — введите свой в Настройках или задайте DEEPSEEK_API_KEY на сервере' });
    } else if (!apiKey) {
      return res.status(400).json({ error: 'Нет provider или apiKey' });
    }

    /* ---------- Cloudflare Workers AI ---------- */
    if (provider === 'cloudflare') {
      if (!account) return res.status(400).json({ error: 'Cloudflare: нужен Account ID (в Настройках)' });
      const cfr = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + '/ai/run/' + model, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ messages, max_tokens: 1024 })
      });
      const cfd = await cfr.json();
      if (!cfr.ok) return res.status(cfr.status).json({ error: cfd.errors?.[0]?.message || ('Cloudflare ошибка ' + cfr.status) });
      const cftext = cfd?.result?.response || '';
      if (!cftext.trim()) return res.status(502).json({ error: 'Cloudflare вернул пустой ответ' });
      return res.status(200).json({ content: cftext });
    }

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
        return res.status(502).json({ error: 'Gemini: нет ответа' + (blocked ? ' (блок: ' + blocked + ')' : '') });
      }
      const gparts = candidate?.content?.parts;
      const gtext = Array.isArray(gparts) ? gparts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('').trim() : '';
      if (gtext) return res.status(200).json({ content: gtext });
      const greason = candidate?.finishReason;
      if (greason === 'SAFETY' || greason === 'RECITATION' || greason === 'BLOCKLIST')
        return res.status(502).json({ error: 'Gemini заблокировал ответ (' + greason + ')' });
      return res.status(502).json({ error: 'Gemini вернул пустой ответ, попробуй переформулировать' });
    }

    /* ---------- DeepSeek: content и reasoning_content — раздельные поля API, без <think>-тегов ---------- */
    if (provider === 'deepseek') {
      const dsHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
      const isReasoning = /reason/i.test(model || '');
      const dsMaxTokens = isReasoning ? 4000 : 1024;

      const dr = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: dsHeaders,
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: dsMaxTokens })
      });
      const dd = await dr.json();
      if (!dr.ok) return res.status(dr.status).json({ error: dd.error?.message || ('DeepSeek ошибка ' + dr.status) });

      const dmsg = dd?.choices?.[0]?.message || {};
      const dtext = (typeof dmsg.content === 'string' ? dmsg.content : '').trim();
      const dreasoning = (typeof dmsg.reasoning_content === 'string' ? dmsg.reasoning_content : '').trim();

      if (dtext || dreasoning) {
        const payload = { content: dtext };
        if (dreasoning) payload.reasoning = dreasoning;
        return res.status(200).json(payload);
      }

      const dfr = dd?.choices?.[0]?.finish_reason || 'unknown';
      return res.status(502).json({ error: 'DeepSeek вернул пустой ответ (finish_reason: ' + dfr + '). Попробуй ещё раз или короче вопрос.' });
    }

    /* ---------- OpenAI-совместимые провайдеры ---------- */
    const endpoints = {
      github:   'https://models.inference.ai.azure.com/chat/completions',
      groq:     'https://api.groq.com/openai/v1/chat/completions'
    };
    const url = endpoints[provider];
    if (!url) return res.status(400).json({ error: 'Неизвестный или платный провайдер: ' + provider });

    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };

    // R1 нужен больший лимит; Groq — явный max_tokens
    const isReasoning = /r1|reason/i.test(model || '');
    const maxTokens = isReasoning ? 4000 : (provider === 'github' ? 1500 : 1024);

    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens })
    });
    const d = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: d.error?.message || ('ошибка ' + r.status) });
    }

    /* Универсальный парсер ответа */
    const msg = d?.choices?.[0]?.message || {};
    let text = (typeof msg.content === 'string' ? msg.content : '') || '';
    if (!text.trim() && typeof msg.reasoning_content === 'string') text = msg.reasoning_content;
    // R1: убрать рассуждения — всё до закрывающего </think> включительно (даже если открывающего <think> нет)
    if (text.includes('</think>')) {
      const after = text.split('</think>').pop();
      if (after && after.trim()) text = after;
    }
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
