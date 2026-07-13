// FreeX Notes Module
import { LS } from './config.js';
import { save, loadJSON, escapeHtml, extractTags } from './utils.js';
import { state, setState } from './state.js';
import { db } from './db.js';
import { toggleSidebar, showToast } from './ui.js';

// Черновик редактируемой заметки — автосохранение/восстановление/защита от потери
let editorBaseline = { title: '', content: '' };

function currentEditorFields() {
  return {
    title: document.getElementById('noteTitle').value,
    content: document.getElementById('noteContent').value
  };
}

function saveDraft() {
  const f = currentEditorFields();
  save(LS.noteDraft, { id: state.editingNoteId, title: f.title, content: f.content });
}

function clearDraft() {
  localStorage.removeItem(LS.noteDraft);
}

function isEditorDirty() {
  const f = currentEditorFields();
  return f.title !== editorBaseline.title || f.content !== editorBaseline.content;
}

function openEditorFields(id, title, content) {
  editorBaseline = { title, content };
  const draft = loadJSON(LS.noteDraft, null);
  if (draft && draft.id === id && (draft.title !== title || draft.content !== content)) {
    document.getElementById('noteTitle').value = draft.title;
    document.getElementById('noteContent').value = draft.content;
    showToast('Восстановлен черновик несохранённых изменений');
  } else {
    document.getElementById('noteTitle').value = title;
    document.getElementById('noteContent').value = content;
  }
}

// Слушатели ставятся один раз — поля статичны в разметке index.html.
// Модульные скрипты грузятся с defer, так что DOMContentLoaded мог уже случиться — подстраховка.
function wireDraftListeners() {
  const titleEl = document.getElementById('noteTitle');
  const contentEl = document.getElementById('noteContent');
  if (titleEl) titleEl.addEventListener('input', saveDraft);
  if (contentEl) contentEl.addEventListener('input', saveDraft);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireDraftListeners);
} else {
  wireDraftListeners();
}

export async function renderNotes() {
  const search = document.getElementById('searchNotes').value.toLowerCase();
  let notes;
  if (search) {
    notes = await db.notes.filter(n => n.title.toLowerCase().includes(search) || n.content.toLowerCase().includes(search)).toArray();
  } else {
    notes = await db.notes.orderBy('updatedAt').reverse().toArray();
  }
  const list = document.getElementById('notesList');
  list.innerHTML = notes.map(n => {
    const date = new Date(n.updatedAt).toLocaleDateString('ru-RU');
    return '<div class="note-item" onclick="window.editNote(' + n.id + ')"><div class="note-title">' + escapeHtml(n.title) + '</div><div class="note-snippet">' + escapeHtml(n.content.slice(0, 120)) + (n.content.length > 120 ? '...' : '') + '</div><div class="note-meta">' + date + ' ' + n.tags.map(t => '<span class="note-tag">#' + escapeHtml(t) + '</span>').join('') + '</div></div>';
  }).join('') || '<div class="empty">Заметок пока нет.<br>Нажми <b>+ Новая заметка</b> в меню слева.</div>';
}

export function newNote() {
  setState({ editingNoteId: null });
  openEditorFields(null, '', '');
  document.body.dataset.activeTab = 'editor';
  document.getElementById('view').style.display = 'none';
  document.getElementById('noteEditor').style.display = 'flex';
  document.getElementById('composer').classList.add('hidden');
}

export async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim() || 'Без названия';
  const content = document.getElementById('noteContent').value;
  const tags = extractTags(content);
  if (state.editingNoteId) {
    await db.notes.update(state.editingNoteId, { title, content, tags, updatedAt: Date.now() });
  } else {
    await db.notes.add({ title, content, tags, createdAt: Date.now(), updatedAt: Date.now() });
  }
  clearDraft();
  closeEditor(true);
}

export function closeEditor(skipConfirm) {
  if (!skipConfirm && isEditorDirty()) {
    if (!confirm('Есть несохранённые изменения в заметке. Уйти без сохранения?')) return;
    clearDraft();
  }
  document.getElementById('noteEditor').style.display = 'none';
  document.getElementById('view').style.display = 'flex';
  document.body.dataset.activeTab = 'notes';
  document.getElementById('composer').classList.remove('hidden');
  renderNotes();
}

export async function editNote(id) {
  const n = await db.notes.get(id);
  setState({ editingNoteId: id });
  openEditorFields(id, n.title, n.content);
  document.body.dataset.activeTab = 'editor';
  document.getElementById('view').style.display = 'none';
  document.getElementById('noteEditor').style.display = 'flex';
  document.getElementById('composer').classList.add('hidden');
}

export async function openNoteByTitle(title) {
  const note = await db.notes.filter(n => n.title.toLowerCase() === title.toLowerCase()).first();
  if (note) {
    setState({ editingNoteId: note.id });
    openEditorFields(note.id, note.title, note.content);
    window.switchTab('notes');
    document.body.dataset.activeTab = 'editor';
    document.getElementById('view').style.display = 'none';
    document.getElementById('noteEditor').style.display = 'flex';
    document.getElementById('composer').classList.add('hidden');
  }
}

export function parseNoteTags(text) {
  const notes = [];
  const regex = /<note\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/note>/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    notes.push({ title: m[1].trim(), content: m[2].trim() });
  }
  return notes;
}

export async function processAiMemory(text) {
  if (!state.aiMemoryEnabled) return text;
  const notes = parseNoteTags(text);
  if (!notes.length) return text;
  for (const n of notes) {
    const existing = await db.notes.filter(x => x.title.toLowerCase() === n.title.toLowerCase()).first();
    if (existing) {
      await db.notes.update(existing.id, { content: n.content, updatedAt: Date.now() });
    } else {
      await db.notes.add({ title: n.title, content: n.content, tags: [], createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  return text.replace(/<note\s+title=["'][^"']+["']\s*>[\s\S]*?<\/note>/gi, '').trim();
}

export async function findRelevantNotes(query) {
  if (!query.trim()) return [];
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return [];
  const allNotes = await db.notes.toArray();
  const scored = allNotes.map(n => {
    const titleLow = n.title.toLowerCase();
    const contentLow = n.content.toLowerCase();
    let score = 0;
    words.forEach(w => {
      if (titleLow.includes(w)) score += 3;
      if (contentLow.includes(w)) score += 1;
      if (titleLow === w) score += 5;
    });
    return { ...n, score };
  }).filter(n => n.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  return scored;
}

export async function renderContextBar(query) {
  const bar = document.getElementById('contextBar');
  const notes = await findRelevantNotes(query);
  if (notes.length && state.currentTab === 'chat') {
    bar.style.display = 'block';
    bar.innerHTML = 'Контекст: ' + notes.map(n => '<span class="context-chip" onclick="window.openNoteByTitle(\'' + escapeHtml(n.title).replace(/'/g, "\\'") + '\')">[[' + escapeHtml(n.title) + ']]</span>').join('');
  } else {
    bar.style.display = 'none';
    bar.innerHTML = '';
  }
  return notes;
}

export async function exportNotes() {
  const notes = await db.notes.toArray();
  const data = { exported: new Date().toISOString(), notes, version: 'FreeX Notes v1' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'freex_notes_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

export async function importNotes(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (Array.isArray(d.notes)) {
        await db.notes.clear();
        for (const n of d.notes) {
          await db.notes.add({ title: n.title, content: n.content, tags: n.tags || [], createdAt: n.createdAt || Date.now(), updatedAt: n.updatedAt || Date.now() });
        }
        alert('✅ Заметки импортированы: ' + d.notes.length);
        if (state.currentTab === 'notes') renderNotes();
      } else alert('❌ Неверный формат');
    } catch(err) { alert('❌ Ошибка: ' + err.message); }
  };
  r.readAsText(file);
  e.target.value = '';
}

export function setAiMemory(v) {
  setState({ aiMemoryEnabled: v });
  localStorage.setItem(LS.aiMemory, v);
  renderAiMemoryBtn();
}

export function renderAiMemoryBtn() {
  document.getElementById('aiMemOn').classList.toggle('active', state.aiMemoryEnabled);
  document.getElementById('aiMemOff').classList.toggle('active', !state.aiMemoryEnabled);
}

export async function clearAllNotes() {
  if (!confirm('Удалить ВСЕ заметки? Это необратимо.')) return;
  await db.notes.clear();
  if (state.currentTab === 'notes') renderNotes();
}

// Expose to window for inline handlers
window.newNote = newNote;
window.saveNote = saveNote;
window.closeEditor = closeEditor;
window.editNote = editNote;
window.openNoteByTitle = openNoteByTitle;
window.setAiMemory = setAiMemory;
window.exportNotes = exportNotes;
window.importNotes = importNotes;
window.clearAllNotes = clearAllNotes;
