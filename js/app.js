// FreeX App - Entry Point
import { LS, ALL_MODELS, KEY_FIELDS, modelLabel } from './config.js';
import { loadJSON, save } from './utils.js';
import { state, setState } from './state.js';
import { db } from './db.js';
import {
  availableModels, getActiveChat, newChat, renderMessages, renderAll,
  populateModelSelect, toggleConf, copyMessage, showView, closeViews,
  openHQ, saveHQUrl, openGH, onGhPathChange, buildHistory
} from './chat.js';
import {
  renderSidebarList, newFolder, deleteFolder, moveChatToFolder
} from './sidebar.js';
import {
  renderNotes, newNote, saveNote, closeEditor, editNote, openNoteByTitle,
  processAiMemory, renderContextBar, setAiMemory, renderAiMemoryBtn,
  exportNotes, importNotes, clearAllNotes
} from './notes.js';
import { pushToGitHub } from './github.js';
import {
  applyTheme, setTheme, toggleSidebar, autoGrow, onKeyDown,
  refreshSend, loadDraft, switchSettingsTab
} from './ui.js';

// Initialize state from localStorage
setState({
  chats: loadJSON(LS.chats, []),
  folders: loadJSON(LS.folders, []),
  keys: loadJSON(LS.keys, {}),
  activeId: localStorage.getItem(LS.active) || null,
  currentTab: localStorage.getItem(LS.tab) || 'chat',
  aiMemoryEnabled: localStorage.getItem(LS.aiMemory) === 'true',
  editingNoteId: null
});

// Expose functions to window for inline onclick handlers
window.toggleSidebar = toggleSidebar;
window.newChat = newChat;
window.newFolder = newFolder;
window.deleteFolder = deleteFolder;
window.moveChatToFolder = moveChatToFolder;
window.selectChat = (id) => { import('./chat.js').then(m => m.selectChat(id)); };
window.deleteChat = (id, ev) => { import('./chat.js').then(m => m.deleteChat(id, ev)); };
window.toggleConf = toggleConf;
window.copyMessage = copyMessage;
window.openHQ = openHQ;
window.saveHQUrl = saveHQUrl;
window.openGH = openGH;
window.onGhPathChange = onGhPathChange;
window.closeViews = closeViews;
window.newNote = newNote;
window.saveNote = saveNote;
window.closeEditor = closeEditor;
window.editNote = editNote;
window.openNoteByTitle = openNoteByTitle;
window.setAiMemory = setAiMemory;
window.exportNotes = exportNotes;
window.importNotes = importNotes;
window.clearAllNotes = clearAllNotes;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.switchTab = switchTab;
window.switchSettingsTab = switchSettingsTab;
window.setTheme = setTheme;
window.pushToGitHub = () => {
  const path = document.getElementById('ghPath').value.trim();
  const content = document.getElementById('ghContent').value;
  pushToGitHub(path, content, document.getElementById('ghStatus'));
};
window.sendMessage = sendMessage;

// Settings
function openSettings() {
  KEY_FIELDS.forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = state.keys[k] || '';
  });
  renderAiMemoryBtn();
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function saveSettings() {
  KEY_FIELDS.forEach(k => {
    const el = document.getElementById(k);
    if (el) state.keys[k] = el.value.trim();
  });
  save(LS.keys, state.keys);
  populateModelSelect();
  closeSettings();
  renderMessages();
}

// Tab switching
function switchTab(tab) {
  setState({ currentTab: tab });
  localStorage.setItem(LS.tab, tab);
  document.body.dataset.activeTab = tab;
  document.getElementById('messages').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('notesView').style.display = tab === 'notes' ? 'flex' : 'none';
  document.getElementById('composer').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('contextBar').style.display = (tab === 'chat' && document.getElementById('contextBar').innerHTML) ? 'block' : 'none';
  if (tab === 'notes') {
    renderNotes();
    document.getElementById('view').style.display = 'flex';
    document.getElementById('noteEditor').style.display = 'none';
  } else {
    renderMessages();
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  localStorage.removeItem(LS.draft);
  let chat = getActiveChat();
  if (!chat) { newChat(); chat = getActiveChat(); }
  chat.messages.push({ role: 'user', text });
  if (chat.messages.filter(m => m.role === 'user').length === 1) chat.title = text.slice(0, 30);
  save(LS.chats, state.chats);
  input.value = '';
  autoGrow(input);
  renderMessages();
  document.getElementById('sendBtn').disabled = true;

  const contextNotes = await renderContextBar(text);

  let sequence;
  if (chat.conf) {
    sequence = availableModels().map(m => m.id);
    if (!sequence.length) sequence = [];
  } else {
    sequence = [chat.model];
  }

  if (!sequence.length) {
    chat.messages.push({ role: 'ai', text: '⚠️ Нет ни одного ключа. Открой Настройки и добавь хотя бы один API-ключ.' });
    save(LS.chats, state.chats);
    renderMessages();
    document.getElementById('sendBtn').disabled = false;
    return;
  }

  for (let i = 0; i < sequence.length; i++) {
    const modelId = sequence[i];
    const model = ALL_MODELS.find(m => m.id === modelId);
    if (chat.conf && i > 0) {
      chat.messages.push({ role: 'sep', text: 'Дальше отвечает: ' + modelLabel(modelId) });
      save(LS.chats, state.chats);
      renderMessages();
    }
    const apiKey = state.keys[model?.keyField || ''];
    if (!apiKey) {
      chat.messages.push({ role: 'ai', model: modelId, text: '⚠️ Нет ключа для ' + modelLabel(modelId) + ' — добавь в Настройках.' });
      save(LS.chats, state.chats);
      renderMessages();
      continue;
    }

    const box = document.getElementById('messages');
    const t = document.createElement('div');
    t.className = 'typing-wrapper';
    t.innerHTML = '<div class="avatar">🔮</div><div class="typing-box"><div class="typing-label">' + modelLabel(modelId) + ' печатает...</div><div class="dots"><span></span><span></span><span></span></div></div>';
    box.appendChild(t);
    document.getElementById('view').scrollTop = document.getElementById('view').scrollHeight;

    try {
      let history = buildHistory(chat);
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
      const { callModel } = await import('./api.js');
    const { modelLabel } = await import('./config.js');
      let reply = await callModel(model, history, apiKey, model.provider === 'cloudflare' ? { account: state.keys.key_cf_account || '' } : {});
      reply = await processAiMemory(reply);
      chat.messages.push({ role: 'ai', model: modelId, text: reply });
    } catch(err) {
      chat.messages.push({ role: 'ai', model: modelId, text: '❌ ' + err.message });
    }
    save(LS.chats, state.chats);
    renderMessages();
  }
  document.getElementById('sendBtn').disabled = false;
}

// Export/Import chats
function exportData() {
  const data = { exported: new Date().toISOString(), chats: state.chats, folders: state.folders, version: 'FreeX v6.2' };
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
        renderAll();
        alert('✅ Импорт выполнен');
      } else alert('❌ Неверный формат');
    } catch(err) { alert('❌ Ошибка чтения'); }
  };
  r.readAsText(file);
  e.target.value = '';
}

window.exportData = exportData;
window.importData = importData;

// Init
applyTheme(localStorage.getItem(LS.theme) || 'dark');
populateModelSelect();
if (!state.activeId && state.chats.length) setState({ activeId: state.chats[0].id });
renderAll();
loadDraft();
refreshSend();

// Input listener
document.getElementById('input').addEventListener('input', () => {
  localStorage.setItem(LS.draft, document.getElementById('input').value);
  refreshSend();
});

// Tab buttons
const topbar = document.getElementById('topbar');
const chatTab = document.createElement('button');
chatTab.className = 'tab-btn active';
chatTab.textContent = '💬 Чат';
chatTab.onclick = () => switchTab('chat');
const notesTab = document.createElement('button');
notesTab.className = 'tab-btn';
notesTab.textContent = '📝 Заметки';
notesTab.onclick = () => switchTab('notes');
topbar.appendChild(chatTab);
topbar.appendChild(notesTab);

const tabStyle = document.createElement('style');
tabStyle.textContent = '.tab-btn{background:var(--bg-2);color:var(--text-dim);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;flex:none;}.tab-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}';
document.head.appendChild(tabStyle);

switchTab(state.currentTab);

