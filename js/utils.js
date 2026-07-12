// FreeX Utilities
export function loadJSON(k, f) {
  try { return JSON.parse(localStorage.getItem(k)) ?? f; }
  catch(e) { return f; }
}

export function save(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

export function extractTags(text) {
  const tags = [];
  const m = text.match(/#(\w+)/g);
  if (m) m.forEach(t => tags.push(t.slice(1)));
  return [...new Set(tags)];
}
