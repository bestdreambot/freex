// FreeX State Management (EventEmitter pattern)
export const events = new EventTarget();

export function emit(name, detail) {
  events.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name, fn) {
  events.addEventListener(name, fn);
}

export const state = {
  chats: [],
  folders: [],
  keys: {},
  activeId: null,
  viewOpen: false,
  currentTab: 'chat',
  aiMemoryEnabled: false,
  editingNoteId: null
};

export function setState(patch) {
  Object.assign(state, patch);
  emit('state:change', state);
  Object.keys(patch).forEach(k => emit(`change:${k}`, patch[k]));
}
