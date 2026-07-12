// FreeX Database (Dexie)
import Dexie from 'https://unpkg.com/dexie@4.0.4/dist/dexie.min.js';

export const db = new Dexie('FreeXDB');
db.version(1).stores({
  notes: '++id, title, updatedAt, *tags',
  chats: '++id, title, updatedAt',
  messages: '++id, chatId, role, model, content, createdAt'
});

// Wiki tables for future
// db.version(2).stores({
//   wiki: '++id, slug, &title, *tags, updatedAt',
//   sources: '++id, url, type, hash',
//   links: '++id, fromId, fromType, toId, toType'
// });
