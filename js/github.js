// FreeX GitHub Deploy
import { GH_REPO, GH_BRANCH } from './config.js';
import { utf8ToBase64 } from './utils.js';
import { state } from './state.js';

export async function pushToGitHub(path, content, statusEl) {
  const token = state.keys.key_github;
  if (!token) { statusEl.textContent = 'Нет GitHub-токена — открой Настройки.'; return; }
  if (!path) { statusEl.textContent = 'Укажи путь к файлу.'; return; }
  if (!content.trim()) { statusEl.textContent = 'Вставь содержимое файла.'; return; }

  document.getElementById('ghPushBtn').disabled = true;
  statusEl.textContent = 'Отправляю ' + path + '...';

  try {
    const apiUrl = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + path;
    const getRes = await fetch(apiUrl + '?ref=' + GH_BRANCH, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
    });
    let sha;
    if (getRes.ok) { sha = (await getRes.json()).sha; }
    else if (getRes.status !== 404) {
      const e = await getRes.json().catch(() => ({}));
      throw new Error(e.message || ('чтение ' + getRes.status));
    }
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'FreeX: ' + (sha ? 'обновление' : 'создание') + ' ' + path + ', ' + new Date().toISOString(),
        content: utf8ToBase64(content),
        sha,
        branch: GH_BRANCH
      })
    });
    const putData = await putRes.json();
    if (!putRes.ok) throw new Error(putData.message || 'GitHub отклонил запрос');
    statusEl.textContent = '✅ ' + (sha ? 'Обновлён' : 'Создан') + ' ' + path + '\nКоммит: ' + (putData.commit?.sha?.slice(0,7) || '—') + '\nVercel задеплоит за 1-2 минуты.';
  } catch(err) {
    statusEl.textContent = 'Ошибка: ' + err.message;
  }
  document.getElementById('ghPushBtn').disabled = false;
}
