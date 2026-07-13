// FreeX API Layer
import { ALL_MODELS } from './config.js';

const REQUEST_TIMEOUT_MS = 55000; // чуть меньше лимита Vercel-функции (60с из vercel.json)

export async function callModel(model, history, apiKey, extra = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let r;
  try {
    r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        provider: model.provider,
        model: model.model || '',
        messages: history,
        apiKey,
        ...extra
      })
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Модель не ответила за ' + Math.round(REQUEST_TIMEOUT_MS / 1000) + 'с — попробуй ещё раз.');
    throw new Error('Сеть недоступна или прокси не ответил.');
  } finally {
    clearTimeout(timer);
  }
  let d;
  try { d = await r.json(); }
  catch(e) { throw new Error('прокси не ответил (залей api/chat.js на GitHub)'); }
  if (!r.ok) throw new Error(d.error || ('ошибка ' + r.status));
  return d.content;
}
