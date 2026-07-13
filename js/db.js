// FreeX Database (Dexie)
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4.0.4/+esm';

export let dbError = null;
let dbInstance;

function noopNotesTable() {
  return {
    toArray: async () => [],
    filter: () => ({ toArray: async () => [], first: async () => null }),
    orderBy: () => ({ reverse: () => ({ toArray: async () => [] }) }),
    get: async () => null,
    add: async () => { throw new Error('IndexedDB недоступен — заметки не сохраняются в этом браузере/режиме.'); },
    update: async () => { throw new Error('IndexedDB недоступен — заметки не сохраняются в этом браузере/режиме.'); },
    clear: async () => {}
  };
}

try {
  dbInstance = new Dexie('FreeXDB');
  dbInstance.version(1).stores({
    notes: '++id, title, updatedAt, *tags',
    chats: '++id, title, updatedAt',
    messages: '++id, chatId, role, model, content, createdAt'
  });
} catch (e) {
  console.error('Dexie init failed:', e);
  dbError = e;
  dbInstance = { notes: noopNotesTable() };
}

export const db = dbInstance;

// Wiki tables for future
// db.version(2).stores({
//   wiki: '++id, slug, &title, *tags, updatedAt',
//   sources: '++id, url, type, hash',
//   links: '++id, fromId, fromType, toId, toType'
// });
