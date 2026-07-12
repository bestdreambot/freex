// FreeX API Layer
import { ALL_MODELS } from './config.js';

export async function callModel(model, history, apiKey, extra = {}) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: model.provider,
      model: model.model || '',
      messages: history,
      apiKey,
      ...extra
    })
  });
  let d;
  try { d = await r.json(); }
  catch(e) { throw new Error('прокси не ответил (залей api/chat.js на GitHub)'); }
  if (!r.ok) throw new Error(d.error || ('ошибка ' + r.status));
  return d.content;
}
