// js/app.js — FreeX 8.1 Main Orchestrator
// Инициализация приложения, обработчики событий, логика отправки сообщений.
// Единственная точка входа — index.html не содержит рабочей логики, только разметку.
console.log('%c[FreeX 8.1] Modular runtime loaded', 'color:#10a37f');

import { LS, ALL_MODELS, KEY_FIELDS, APP_VERSION, modelLabel } from './config.js';
import { save, loadJSON } from './utils.js';
import { state, setState } from './state.js';
import { dbError } from './db.js';
import { callModel } from './api.js';
import * as UI from './ui.js';
import * as Chat from './chat.js';
import * as Notes from './notes.js';
import * as Sidebar from './sidebar.js';
import { pushToGitHub as ghPush } from './github.js';

let chatTabBtn = null;
let notesTabBtn = null;

/* ─────────────────────────── State init ─────────────────────────── */
function initState() {
  setState({
    chats: loadJSON(LS.chats, []),
    folders: loadJSON(LS.folders, []),
    keys: loadJSON(LS.keys, {}),
    activeId: localStorage.getItem(LS.active) || null,
    currentTab: localStorage.getItem(LS.tab) || 'chat',
    aiMemoryEnabled: localStorage.getItem(LS.aiMemory) === 'true',
    viewOpen: false,
    editingNoteId: null
  });
  if (!state.activeId && state.chats.length) setState({ activeId: state.chats[0].id });
}

/* ─────────────────────────── Tab switching ──────────────────────── */
function switchTab(tab) {
  setState({ currentTab: tab });
  localStorage.setItem(LS.tab, tab);
  document.body.dataset.activeTab = tab;

  document.getElementById('messages').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('notesView').style.display = tab === 'notes' ? 'flex' : 'none';
  document.getElementById('noteEditor').style.display = 'none';
  document.getElementById('view').style.display = 'flex';

  const cb = document.getElementById('contextBar');
  cb.style.display = (tab === 'chat' && cb.innerHTML) ? 'block' : 'none';

  chatTabBtn && chatTabBtn.classList.toggle('active', tab === 'chat');
  notesTabBtn && notesTabBtn.classList.toggle('active', tab === 'notes');

  if (tab === 'notes') Notes.renderNotes();
  else Chat.renderMessages();
}

/* ─────────────────────────── Settings ───────────────────────────── */
function openSettings() {
  KEY_FIELDS.forEach(k => { const el = document.getElementById(k); if (el) el.value = state.keys[k] || ''; });
  Notes.renderAiMemoryBtn();
  document.getElementById('settingsModal').classList.add('open');
}
function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}
function saveSettings() {
  KEY_FIELDS.forEach(k => { const el = document.getElementById(k); if (el) state.keys[k] = el.value.trim(); });
  save(LS.keys, state.keys);
  Chat.populateModelSelect();
  closeSettings();
  Chat.renderMessages();
  UI.showToast('Ключи сохранены (хранятся только в этом браузере)');
}

/* ──────────────────────── Data export / import ──────────────────── */
function exportData() {
  // Экспорт содержит только чаты и папки — ключи и токены сюда никогда не попадают.
  const data = { exported: new Date().toISOString(), chats: state.chats, folders: state.folders, version: APP_VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'freex_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (Array.isArray(d.chats)) {
        state.chats = d.chats;
        state.folders = Array.isArray(d.folders) ? d.folders : [];
        setState({ activeId: state.chats[0]?.id || null });
        save(LS.chats, state.chats);
        save(LS.folders, state.folders);
        if (state.activeId) localStorage.setItem(LS.active, state.activeId);
        Chat.renderAll();
        UI.showToast('Импорт выполнен');
      } else alert('❌ Неверный формат');
    } catch (err) { alert('❌ Ошибка чтения'); }
  };
  r.readAsText(file);
  e.target.value = '';
}

/* ─────────────────────── GitHub deploy wrapper ──────────────────── */
function pushToGitHub() {
  const path = document.getElementById('ghPath').value.trim();
  const content = document.getElementById('ghContent').value;
  const statusEl = document.getElementById('ghStatus');
  ghPush(path, content, statusEl);
}

/* ───────────────────────── Send message ─────────────────────────── */
async function sendMessage() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  localStorage.removeItem(LS.draft);

  let chat = Chat.getActiveChat();
  if (!chat) { Chat.newChat(); chat = Chat.getActiveChat(); }

  chat.messages.push({ role: 'user', text });
  if (chat.messages.filter(m => m.role === 'user').length === 1) chat.title = text.slice(0, 30);
  save(LS.chats, state.chats);
  input.value = '';
  UI.autoGrow(input);
  UI.refreshSend();
  Chat.renderMessages();
  document.getElementById('sendBtn').disabled = true;

  const contextNotes = await Notes.renderContextBar(text);

  let sequence;
  if (chat.conf) sequence = Chat.availableModels().map(m => m.id);
  else sequence = [chat.model];

  if (!sequence.length) {
    chat.messages.push({ role: 'ai', text: '⚠️ Нет ни одного ключа. Открой Настройки и добавь хотя бы один API-ключ.' });
    save(LS.chats, state.chats);
    Chat.renderMessages();
    document.getElementById('sendBtn').disabled = false;
    return;
  }

  const viewEl = document.getElementById('view');

  for (let i = 0; i < sequence.length; i++) {
    const modelId = sequence[i];
    const model = ALL_MODELS.find(m => m.id === modelId);
    if (chat.conf && i > 0) {
      chat.messages.push({ role: 'sep', text: 'Дальше отвечает: ' + modelLabel(modelId) });
      save(LS.chats, state.chats);
      Chat.renderMessages();
    }

    // DeepSeek работает без личного ключа — сервер использует DEEPSEEK_API_KEY при его отсутствии.
    // Остальные провайдеры по-прежнему требуют личный ключ, введённый в Настройках.
    const apiKey = state.keys[model?.keyField || ''] || '';
    if (model.provider !== 'deepseek' && !apiKey) {
      chat.messages.push({ role: 'ai', model: modelId, text: '⚠️ Нет ключа для ' + modelLabel(modelId) + ' — добавь в Настройках.' });
      save(LS.chats, state.chats);
      Chat.renderMessages();
      continue;
    }

    const box = document.getElementById('messages');
    const t = document.createElement('div');
    t.className = 'typing-wrapper';
    t.innerHTML = '<div class="avatar">🔮</div><div class="typing-box"><div class="typing-label">' + modelLabel(modelId) + ' печатает...</div><div class="dots"><span></span><span></span><span></span></div></div>';
    box.appendChild(t);
    viewEl.scrollTop = viewEl.scrollHeight;

    try {
      let history = Chat.buildHistory(chat);
      const sysParts = [];
      if (contextNotes.length) {
        sysParts.push('[Контекст из заметок пользователя: ' + contextNotes.map(n => n.title).join(', ') + '. Если уместно, цитируй [[название]] и используй эту информацию.]');
      }
      if (state.aiMemoryEnabled) {
        sysParts.push('[Ты можешь создавать и обновлять заметки пользователя. Если пользователь просит запомнить что-то или ты считаешь информацию важной, используй тег: <note title="Название">Содержимое заметки</note>. Не упоминай тег в ответе — он обработается автоматически.]');
      }
      if (sysParts.length) {
        const sysText = sysParts.join('\n\n');
        if (model.provider === 'gemini') {
          const firstUserIdx = history.findIndex(m => m.role === 'user');
          if (firstUserIdx >= 0) history[firstUserIdx].content = sysText + '\n\n' + history[firstUserIdx].content;
          else history.unshift({ role: 'user', content: sysText });
        } else {
          history.unshift({ role: 'system', content: sysText });
        }
      }
      const extra = {};
      if (model.provider === 'cloudflare') extra.account = state.keys.key_cf_account || '';
      let reply = await callModel(model, history, apiKey, extra);
      reply = await Notes.processAiMemory(reply);
      chat.messages.push({ role: 'ai', model: modelId, text: reply });
    } catch (err) {
      chat.messages.push({ role: 'ai', model: modelId, text: '❌ ' + err.message });
    }
    save(LS.chats, state.chats);
    Chat.renderMessages();
  }
  document.getElementById('sendBtn').disabled = false;
}

/* ─────────────────── Wire global (inline handlers) ──────────────── */
function exposeGlobals() {
  // UI helpers
  window.toggleSidebar = UI.toggleSidebar;
  window.setTheme = UI.setTheme;
  window.applyTheme = UI.applyTheme;
  window.switchSettingsTab = UI.switchSettingsTab;
  window.onKeyDown = UI.onKeyDown;
  window.refreshSend = UI.refreshSend;
  window.showToast = UI.showToast;
  window.autoGrow = (el) => { UI.autoGrow(el); UI.refreshSend(); };

  // App orchestrator
  window.sendMessage = sendMessage;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.saveSettings = saveSettings;
  window.exportData = exportData;
  window.importData = importData;
  window.switchTab = switchTab;
  window.pushToGitHub = pushToGitHub;

  // Chat module
  window.newChat = Chat.newChat;
  window.selectChat = Chat.selectChat;
  window.deleteChat = Chat.deleteChat;
  window.toggleConf = Chat.toggleConf;
  window.copyMessage = Chat.copyMessage;
  window.openHQ = Chat.openHQ;
  window.openGH = Chat.openGH;
  window.closeViews = Chat.closeViews;
  window.saveHQUrl = Chat.saveHQUrl;
  window.onGhPathChange = Chat.onGhPathChange;

  // Sidebar module
  window.newFolder = Sidebar.newFolder;
  window.deleteFolder = Sidebar.deleteFolder;
  window.moveChatToFolder = Sidebar.moveChatToFolder;

  // Notes module
  window.newNote = Notes.newNote;
  window.saveNote = Notes.saveNote;
  window.closeEditor = Notes.closeEditor;
  window.editNote = Notes.editNote;
  window.openNoteByTitle = Notes.openNoteByTitle;
  window.renderNotes = Notes.renderNotes;
  window.setAiMemory = Notes.setAiMemory;
  window.exportNotes = Notes.exportNotes;
  window.importNotes = Notes.importNotes;
  window.clearAllNotes = Notes.clearAllNotes;
}

/* ─────────────────── Topbar tab buttons + styles ────────────────── */
function buildTabButtons() {
  const topbar = document.getElementById('topbar');
  chatTabBtn = document.createElement('button');
  chatTabBtn.className = 'tab-btn active';
  chatTabBtn.textContent = '💬 Чат';
  chatTabBtn.onclick = () => switchTab('chat');
  notesTabBtn = document.createElement('button');
  notesTabBtn.className = 'tab-btn';
  notesTabBtn.textContent = '📝 Заметки';
  notesTabBtn.onclick = () => switchTab('notes');
  topbar.appendChild(chatTabBtn);
  topbar.appendChild(notesTabBtn);
}

/* ─────────────────────────── Bootstrap ──────────────────────────── */
function init() {
  initState();
  exposeGlobals();

  UI.applyTheme(localStorage.getItem(LS.theme) || 'dark');
  Chat.populateModelSelect();
  Chat.renderAll();
  UI.loadDraft();
  UI.refreshSend();

  if (dbError) {
    UI.showToast('Заметки недоступны в этом браузере/режиме (IndexedDB заблокирован)');
  }

  const inputEl = document.getElementById('input');
  if (inputEl) inputEl.addEventListener('input', () => {
    localStorage.setItem(LS.draft, inputEl.value);
  });

  buildTabButtons();
  switchTab(state.currentTab);
}

// Модульные скрипты грузятся с defer — DOM уже готов, но подстраховываемся.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
