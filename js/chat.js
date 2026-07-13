// FreeX Chat Module
import { LS, ALL_MODELS, MAX_HISTORY, modelLabel, modelColor } from './config.js';
import { save, escapeHtml } from './utils.js';
import { state, setState } from './state.js';
import { db } from './db.js';
import { callModel } from './api.js';
import { renderSidebarList } from './sidebar.js';
import { toggleSidebar } from './ui.js';

const viewEl = document.getElementById('view');

// DeepSeek работает без личного ключа — сервер использует DEEPSEEK_API_KEY при отсутствии своего.
export function availableModels() {
  return ALL_MODELS.filter(m => m.provider === 'deepseek' || state.keys[m.keyField]);
}

export function getActiveChat() {
  return state.chats.find(c => c.id === state.activeId);
}

export function newChat() {
  const chat = {
    id: 'c' + Date.now(),
    title: 'Новый чат',
    model: (availableModels()[0] || ALL_MODELS[0]).id,
    conf: false,
    folder: null,
    messages: []
  };
  state.chats.unshift(chat);
  setState({ activeId: chat.id });
  save(LS.chats, state.chats);
  localStorage.setItem(LS.active, state.activeId);
  renderAll();
  toggleSidebar(false);
  closeViews();
}

export function selectChat(id) {
  setState({ activeId: id });
  localStorage.setItem(LS.active, id);
  closeViews();
  renderAll();
  toggleSidebar(false);
}

export function deleteChat(id, ev) {
  ev.stopPropagation();
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.activeId === id) setState({ activeId: state.chats[0]?.id || null });
  save(LS.chats, state.chats);
  renderAll();
}

export function toggleConf() {
  let chat = getActiveChat();
  if (!chat) { newChat(); chat = getActiveChat(); }
  chat.conf = !chat.conf;
  save(LS.chats, state.chats);
  renderMessages();
}

export function buildHistory(chat) {
  return chat.messages
    .filter(m => (m.role === 'user' || m.role === 'ai') && m.text != null && String(m.text).trim() !== '')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.text) }));
}

export function renderMessages() {
  const chat = getActiveChat();
  const box = document.getElementById('messages');
  document.getElementById('chatTitle').textContent = chat ? (chat.conf ? '🎯 Конференция' : chat.title) : 'FreeX';
  const sel = document.getElementById('modelSelect');
  if (chat) {
    sel.value = chat.model;
    sel.disabled = !!chat.conf;
    document.getElementById('confBtn').classList.toggle('on', !!chat.conf);
  }
  if (!chat) {
    box.innerHTML = '<div class="empty">Нет открытого чата.<br><b>+ Новый чат</b> в меню слева.</div>';
    return;
  }
  if (chat.messages.length === 0) {
    box.innerHTML = '<div class="empty">' + (chat.conf ? 'Конференция включена: все модели с ключами ответят по очереди.' : 'Выбери модель и начни диалог. Кнопка 🎯 Конференция — опросить всех сразу.') + '</div>';
    return;
  }
  box.innerHTML = chat.messages.map((m, idx) => {
    if (m.role === 'sep') return '<div class="sepMsg">' + escapeHtml(m.text) + '</div>';
    const isUser = m.role === 'user';
    const color = (!isUser && m.model) ? modelColor(m.model) : '';
    const label = (!isUser && m.model) ? '<div class="msg-model-label" data-model="' + m.model + '" style="color:' + color + '">' + modelLabel(m.model) + '</div>' : '';
    const actions = !isUser ? '<div class="msg-actions"><button onclick="window.copyMessage(' + idx + ')" id="cp_' + idx + '">📋 Копировать</button></div>' : '';
    return '<div class="msg-wrapper ' + (isUser ? 'user' : 'ai') + '"><div class="avatar">' + (isUser ? '👤' : '🔮') + '</div><div class="msg-content">' + label + '<div class="msg-bubble">' + escapeHtml(m.text) + '</div>' + actions + '</div></div>';
  }).join('');
  viewEl.scrollTop = viewEl.scrollHeight;
}

export function copyMessage(idx) {
  const chat = getActiveChat();
  if (!chat) return;
  const msg = chat.messages[idx];
  if (!msg) return;
  const done = () => {
    const b = document.getElementById('cp_' + idx);
    if (b) { const o = b.textContent; b.textContent = '✅ Скопировано'; setTimeout(() => b.textContent = o, 2000); }
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(msg.text).then(done).catch(() => fallbackCopy(msg.text, done));
  } else fallbackCopy(msg.text, done);
}

function fallbackCopy(t, cb) {
  const a = document.createElement('textarea');
  a.value = t;
  document.body.appendChild(a);
  a.select();
  try { document.execCommand('copy'); } catch(e) {}
  a.remove();
  cb && cb();
}

export function renderAll() {
  renderSidebarList();
  renderMessages();
}

export function populateModelSelect() {
  const sel = document.getElementById('modelSelect');
  const avail = availableModels();
  const list = avail.length ? avail : ALL_MODELS;
  sel.innerHTML = list.map(m => '<option value="' + m.id + '">' + m.label + '</option>').join('');
  sel.onchange = () => {
    const c = getActiveChat();
    if (c) { c.model = sel.value; save(LS.chats, state.chats); }
  };
}

// Views
export function showView(which) {
  setState({ viewOpen: true });
  document.body.dataset.activeTab = 'view';
  document.getElementById('view').style.display = 'none';
  document.getElementById('composer').classList.add('hidden');
  document.getElementById('hqView').classList.toggle('active', which === 'hq');
  document.getElementById('ghView').classList.toggle('active', which === 'gh');
  document.getElementById('modelSelect').style.display = 'none';
  document.getElementById('confBtn').style.display = 'none';
  toggleSidebar(false);
  renderSidebarList();
}

export function closeViews() {
  setState({ viewOpen: false });
  document.body.dataset.activeTab = 'chat';
  document.getElementById('view').style.display = 'flex';
  document.getElementById('composer').style.display = 'flex';
  document.getElementById('composer').classList.remove('hidden');
  document.getElementById('hqView').classList.remove('active');
  document.getElementById('ghView').classList.remove('active');
  document.getElementById('modelSelect').style.display = '';
  document.getElementById('confBtn').style.display = '';
  renderMessages();
}

export function openHQ() {
  showView('hq');
  document.getElementById('chatTitle').textContent = 'HQ (Notion)';
  const url = localStorage.getItem(LS.hqUrl);
  const fr = document.getElementById('hqFrame'), em = document.getElementById('hqEmpty');
  if (url) { fr.src = url; fr.style.display = 'block'; em.style.display = 'none'; }
  else { fr.style.display = 'none'; em.style.display = 'block'; }
}

export function saveHQUrl() {
  const v = document.getElementById('hqUrlInput').value.trim();
  if (!v) return;
  localStorage.setItem(LS.hqUrl, v);
  openHQ();
}

export function openGH() {
  showView('gh');
  document.getElementById('chatTitle').textContent = 'Деплой на GitHub';
}

export function onGhPathChange() {
  const sel = document.getElementById('ghPathSelect');
  const inp = document.getElementById('ghPath');
  if (sel.value === '__custom__') { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
  else if (sel.value === 'agents/') { inp.style.display = 'block'; inp.value = 'agents/'; inp.focus(); inp.setSelectionRange(7, 7); }
  else { inp.style.display = 'none'; inp.value = sel.value; }
}
