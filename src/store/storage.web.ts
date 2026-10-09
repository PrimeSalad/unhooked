// Web: expo-sqlite/kv-store needs synchronous SQLite and opens a second OPFS connection that
// conflicts with the main database ("Invalid VFS state"). Use localStorage on web instead.
export const settingsStorage = globalThis.localStorage;
