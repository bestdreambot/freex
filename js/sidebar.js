// FreeX Sidebar Module
import { LS } from './config.js';
import { save, escapeHtml } from './utils.js';
import { state, setState } from './state.js';
import { getActiveChat, selectChat, deleteChat, newChat } from './chat.js';
import { toggleSidebar } from './ui.js';

export function newFolder() {
  const name = prompt('Название папки:');
  if (!name) return;
  state.folders.unshift({ id: 'f' + Date.now(), name });
  save(LS.folders, state.folders);
  renderSidebarList();
}

export function deleteFolder(id, ev) {
  ev.stopPropagation();
  if (!confirm('Удалить папку? Чаты внутри станут без папки.')) return;
  state.chats.forEach(c => { if (c.folder === id) c.folder = null; });
  state.folders = state.folders.filter(f => f.id !== id);
  save(LS.folders, state.folders);
  save(LS.chats, state.chats);
  renderSidebarList();
}

export function moveChatToFolder(id, ev) {
  ev.stopPropagation();
  const names = state.folders.map((f, i) => (i + 1) + '. ' + f.name).join('\n');
  const ans = prompt('В какую папку? Введи номер (0 — без папки):\n0. Без папки\n' + names);
  if (ans === null) return;
  const idx = parseInt(ans, 10);
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  chat.folder = (idx === 0 || isNaN(idx)) ? null : (state.folders[idx - 1]?.id || null);
  save(LS.chats, state.chats);
  renderSidebarList();
}

function chatItemHTML(c) {
  return '<div class="sb-item ' + (c.id === state.activeId && !state.viewOpen ? 'active' : '') + '" onclick="window.selectChat(\'' + c.id + '\')"><span>' + escapeHtml(c.title) + '</span><span style="display:flex;gap:6px;"><span class="del" onclick="window.moveChatToFolder(\'' + c.id + '\',event)" title="В папку">📁</span><span class="del" onclick="window.deleteChat(\'' + c.id + '\',event)">✕</span></span></div>';
}

export function renderSidebarList() {
  const list = document.getElementById('chatList');
  let html = '';
  state.folders.forEach(f => {
    html += '<div class="sb-folder"><span class="fname">📁 ' + escapeHtml(f.name) + '</span><span class="del" onclick="window.deleteFolder(\'' + f.id + '\',event)">✕</span></div>';
    state.chats.filter(c => c.folder === f.id).forEach(c => {
      html += '<div class="sb-chat-in-folder">' + chatItemHTML(c) + '</div>';
    });
  });
  const loose = state.chats.filter(c => !c.folder || !state.folders.find(f => f.id === c.folder));
  if (loose.length) {
    html += '<div class="sb-label" style="text-transform:none;">Чаты</div>';
    loose.forEach(c => { html += chatItemHTML(c); });
  }
  list.innerHTML = html || '<div class="sb-label">Пока пусто</div>';
}

// Expose to window for inline onclick handlers
window.newFolder = newFolder;
window.deleteFolder = deleteFolder;
window.moveChatToFolder = moveChatToFolder;
window.selectChat = selectChat;
window.deleteChat = deleteChat;
window.newChat = newChat;
