// FreeX UI Layer
import { LS } from './config.js';
import { save, loadJSON } from './utils.js';
import { state, setState } from './state.js';

export function applyTheme(t) {
  const r = document.documentElement;
  if (t === 'light') {
    r.style.setProperty('--bg','#f0f0f2');
    r.style.setProperty('--bg-2','#e8e8ea');
    r.style.setProperty('--bg-3','#dddde0');
    r.style.setProperty('--line','#c8c8cc');
    r.style.setProperty('--text','#1a1a1e');
    r.style.setProperty('--text-dim','#6a6a74');
    r.style.setProperty('--bg-rgb','240,240,242');
    document.getElementById('app').style.background = '#f0f0f2';
  } else if (t === 'dark') {
    r.style.setProperty('--bg','#212121');
    r.style.setProperty('--bg-2','#2f2f2f');
    r.style.setProperty('--bg-3','#3a3a3a');
    r.style.setProperty('--line','#4a4a4a');
    r.style.setProperty('--text','#ececec');
    r.style.setProperty('--text-dim','#9b9b9b');
    r.style.setProperty('--bg-rgb','33,33,33');
    document.getElementById('app').style.background = '#212121';
  } else {
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    return;
  }
  localStorage.setItem(LS.theme, t);
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}

export function setTheme(t) { applyTheme(t); }

export function toggleSidebar(force) {
  const sb = document.getElementById('sidebar'), ov = document.getElementById('sidebarOverlay');
  const open = force === undefined ? !sb.classList.contains('open') : force;
  sb.classList.toggle('open', open);
  ov.classList.toggle('open', open);
}

export function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

export function onKeyDown(e) {
  const mob = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
  if (e.key === 'Enter') {
    if (mob && !e.shiftKey) { e.preventDefault(); window.sendMessage?.(); }
    else if (!mob && (e.metaKey || e.ctrlKey)) { e.preventDefault(); window.sendMessage?.(); }
  }
}

export function refreshSend() {
  document.getElementById('sendBtn').disabled = document.getElementById('input').value.trim() === '';
}

export function loadDraft() {
  const d = localStorage.getItem(LS.draft) || '';
  if (d) { const i = document.getElementById('input'); i.value = d; autoGrow(i); }
}

export function switchSettingsTab(id) {
  document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector('.tab[data-tab="' + id + '"]').classList.add('active');
}
