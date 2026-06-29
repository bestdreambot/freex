// ============================================================
//  CORE.JS — Стабильная логика. НЕ ТРОГАТЬ.
//  Всё, что здесь есть, работает и не требует изменений.
// ============================================================

// ----- CONFIG (единственное, что можно менять) -----
const MODELS = {
  deepseek: {
    name: 'DeepSeek',
    provider: 'deepseek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    keyEnv: 'keyDeepSeek',
    model: 'deepseek-chat',
    maxTokens: 1500,
    temperature: 0.7,
    requiresKey: true
  },
  gemini: {
    name: 'Gemini',
    provider: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    keyEnv: 'keyGemini',
    model: 'gemini-2.0-flash',
    maxTokens: 1500,
    temperature: 0.7,
    requiresKey: true
  },
  groq: {
    name: 'Groq',
    provider: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'keyGroq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1500,
    temperature: 0.7,
    requiresKey: true
  },
  qwen: {
    name: 'Qwen',
    provider: 'qwen',
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    keyEnv: 'keyQwen',
    model: 'qwen-plus',
    maxTokens: 1500,
    temperature: 0.7,
    requiresKey: true
  },
  grok_free: {
    name: 'Grok (Free)',
    provider: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'keyOpenRouter',
    model: 'x-ai/grok-4-fast:free',
    maxTokens: 1500,
    temperature: 0.7,
    requiresKey: true
  },
  kimi_free: {
    name: 'Kimi (Free)',
    provider: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'keyOpenRouter',
    model: 'moonshotai/kimi-k2.7:free',
    maxTokens: 1500,
    temperature: 0.7,
    requiresKey: true
  }
};

const DEFAULT_FOLDERS = [
  { id: 'inbox', name: '📥 Входящие' },
  { id: 'work', name: '💼 Work' },
  { id: 'ideas', name: '💡 Идеи' }
];

// ============================================================
//  STATE
// ============================================================
let state = {
  chats: [],
  folders: [],
  currentChatId: null,
  currentFolderId: null
};

// ============================================================
//  DOM HELPERS
// ============================================================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ============================================================
//  STORAGE
// ============================================================
function loadState() {
  const saved = localStorage.getItem('freex_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = parsed;
      if (!state.chats) state.chats = [];
      if (!state.folders) state.folders = [];
      if (!state.currentChatId && state.chats.length > 0) {
        state.currentChatId = state.chats[0].id;
      }
      return;
    } catch (e) {}
  }
  state.chats = [];
  state.folders = JSON.parse(JSON.stringify(DEFAULT_FOLDERS));
  state.currentChatId = null;
  state.currentFolderId = null;
}

function saveState() {
  localStorage.setItem('freex_state', JSON.stringify(state));
}

function loadKeys() {
  ['keyDeepSeek', 'keyGemini', 'keyGroq', 'keyQwen', 'keyOpenRouter'].forEach(k => {
    const val = localStorage.getItem(k);
    if (val) {
      const input = document.getElementById(k);
      if (input) input.value = val;
    }
  });
}

function saveKeys() {
  ['keyDeepSeek', 'keyGemini', 'keyGroq', 'keyQwen', 'keyOpenRouter'].forEach(k => {
    const input = document.getElementById(k);
    if (input) localStorage.setItem(k, input.value.trim());
  });
}

function getKey(provider) {
  const map = {
    deepseek: 'keyDeepSeek',
    gemini: 'keyGemini',
    groq: 'keyGroq',
    qwen: 'keyQwen',
    openrouter: 'keyOpenRouter'
  };
  return localStorage.getItem(map[provider]) || '';
}

// ============================================================
//  CHATS
// ============================================================
function createChat(title) {
  const chat = {
    id: 'chat_' + Date.now(),
    title: title || 'Новый чат',
    messages: [],
    folderId: state.currentFolderId || null,
    createdAt: Date.now()
  };
  state.chats.push(chat);
  state.currentChatId = chat.id;
  saveState();
  return chat;
}

function getCurrentChat() {
  return state.chats.find(c => c.id === state.currentChatId) || null;
}

function deleteChatById(id) {
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.currentChatId === id) {
    state.currentChatId = state.chats.length > 0 ? state.chats[0].id : null;
  }
  saveState();
}

function switchChat(id) {
  state.currentChatId = id;
}

// ============================================================
//  MESSAGES
// ============================================================
function addMessage(role, content) {
  const chat = getCurrentChat();
  if (!chat) return;
  chat.messages.push({ role, content, timestamp: Date.now() });
  saveState();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
//  API CALLS
// ============================================================
async function callModel(config, prompt) {
  const key = getKey(config.provider);
  switch (config.provider) {
    case 'deepseek': return callDeepSeek(config, prompt, key);
    case 'gemini': return callGemini(config, prompt, key);
    case 'groq': return callGroq(config, prompt, key);
    case 'qwen': return callQwen(config, prompt, key);
    case 'openrouter': return callOpenRouter(config, prompt, key);
    default: throw new Error('Неизвестный провайдер');
  }
}

async function callDeepSeek(config, prompt, key) {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], temperature: config.temperature, max_tokens: config.maxTokens })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Ошибка DeepSeek');
  return data.choices[0].message.content;
}

async function callGemini(config, prompt, key) {
  const res = await fetch(config.url + '?key=' + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens } })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Ошибка Gemini');
  return data.candidates[0].content.parts[0].text;
}

async function callGroq(config, prompt, key) {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], temperature: config.temperature, max_tokens: config.maxTokens })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Ошибка Groq');
  return data.choices[0].message.content;
}

async function callQwen(config, prompt, key) {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: config.model, input: { messages: [{ role: 'user', content: prompt }] }, parameters: { temperature: config.temperature, max_tokens: config.maxTokens } })
  });
  const data = await res.json();
  if (data.code) throw new Error(data.message || 'Ошибка Qwen');
  return data.output.choices[0].message.content;
}

async function callOpenRouter(config, prompt, key) {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Ошибка OpenRouter');
  return data.choices[0].message.content;
}

// ============================================================
//  PARALLEL REQUEST (Grok + DeepSeek одновременно)
// ============================================================
async function sendToMultipleModels(prompt, modelList) {
  const results = await Promise.all(
    modelList.map(async (modelKey) => {
      const config = MODELS[modelKey];
      if (!config) return { model: modelKey, error: 'Модель не найдена' };
      try {
        const response = await callModel(config, prompt);
        return { model: config.name, response };
      } catch (e) {
        return { model: config.name, error: e.message };
      }
    })
  );
  return results;
}

// ============================================================
//  EXPORT
// ============================================================
function exportData() {
  const data = localStorage.getItem('freex_state');
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'freex_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}
