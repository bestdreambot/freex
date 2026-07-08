// api/chat.js — Vercel Serverless Function (прокси для всех моделей)
// Решает CORS: браузер зовёт /api/chat (свой домен), функция ходит к API моделей.
// Ключи по-прежнему приходят с фронта (в localStorage). Позже можно перенести в Vercel Env Variables.

export default async function handler(req, res) {
  // CORS для собственного фронта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  try {
    // Тело может прийти строкой — подстрахуемся
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { provider, model, messages, apiKey } = body || {};
    if (!provider || !apiKey) return res.status(400).json({ error: 'Нет provider или apiKey' });

    // ----- Gemini: своя структура -----
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
      if (!gr.ok) return res.status(gr.status).json({ error: gd.error?.message || 'Gemini error' });
      return res.status(200).json({ content: gd.candidates?.[0]?.content?.parts?.[0]?.text || '' });
    }

    // ----- OpenAI-совместимые провайдеры -----
    const endpoints = {
      deepseek: 'https://api.deepseek.com/v1/chat/completions',
      grok:     'https://api.x.ai/v1/chat/completions',
      github:   'https://models.inference.ai.azure.com/chat/completions?api-version=2024-08-01-preview',
      groq:     'https://api.groq.com/openai/v1/chat/completions',
      cerebras: 'https://api.cerebras.ai/v1/chat/completions',
      mistral:  'https://api.mistral.ai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions'
    };
    const url = endpoints[provider];
    if (!url) return res.status(400).json({ error: 'Неизвестный провайдер: ' + provider });

    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://freex-xi.vercel.app';
      headers['X-Title'] = 'FreeX';
    }

    // GitHub Models и DeepSeek-R1 имеют меньший лимит — режем max_tokens скромнее
    const maxTokens = provider === 'github' ? 1500 : 2000;

    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens })
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: d.error?.message || ('Ошибка ' + r.status) });
    return res.status(200).json({ content: d.choices?.[0]?.message?.content || '' });

  } catch (e) {
    return res.status(500).json({ error: 'Прокси: ' + e.message });
  }
}
