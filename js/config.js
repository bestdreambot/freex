// FreeX Config & Constants
export const LS = {
  chats: 'freex_chats',
  folders: 'freex_folders',
  keys: 'freex_keys',
  hqUrl: 'freex_hq_url',
  active: 'freex_active_chat',
  draft: 'freex_draft',
  noteDraft: 'freex_note_draft',
  theme: 'freex_theme',
  aiMemory: 'freex_ai_memory',
  tab: 'freex_tab'
};

export const APP_VERSION = 'FreeX 8.1';

export const GH_REPO = 'bestdreambot/freex';
export const GH_BRANCH = 'main';
export const MAX_HISTORY = 12;

export const ALL_MODELS = [
  { id:'deepseek', label:'DeepSeek', provider:'deepseek', keyField:'key_deepseek', model:'deepseek-chat', color:'#10a37f' },
  { id:'gh_gpt4o', label:'GPT-4o (GitHub)', provider:'github', keyField:'key_github', model:'gpt-4o', color:'#19c37d' },
  { id:'gh_r1', label:'DeepSeek-R1 (GitHub)', provider:'github', keyField:'key_github', model:'DeepSeek-R1', color:'#ff6b35' },
  { id:'gemini', label:'Gemini 2.5 Flash', provider:'gemini', keyField:'key_gemini', model:'gemini-2.5-flash', color:'#4285f4' },
  { id:'groq', label:'Llama 3.3 70B (Groq)', provider:'groq', keyField:'key_groq', model:'llama-3.3-70b-versatile', color:'#f55036' },
  { id:'cf_llama', label:'Llama 3.3 (Cloudflare)', provider:'cloudflare', keyField:'key_cloudflare', model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast', color:'#f48120' }
];

export const KEY_FIELDS = ['key_deepseek','key_github','key_gemini','key_groq','key_cloudflare','key_cf_account'];

export function modelLabel(id) {
  return (ALL_MODELS.find(m => m.id === id) || {}).label || id;
}

export function modelColor(id) {
  return (ALL_MODELS.find(m => m.id === id) || {}).color || '#10a37f';
}
