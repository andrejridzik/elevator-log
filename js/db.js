/* IndexedDB wrapper for elevator logs. One store: "logs".
 * Record shape: { id, timestamp (ms epoch), floor (int), small (int), large (int), user (string) }
 */
const DB_NAME = 'elevator-log';
const DB_VERSION = 1;
const STORE = 'logs';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

const ElevatorDB = {
  async addLog({ timestamp, floor, small, large, user }) {
    return withStore('readwrite', (store) => {
      store.add({ timestamp, floor, small, large, user: user || 'Unknown' });
    });
  },

  async getAllLogs() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getLastLog() {
    const rows = await this.getAllLogs();
    return rows.length ? rows[0] : null;
  },

  async deleteLog(id) {
    return withStore('readwrite', (store) => {
      store.delete(id);
    });
  },

  async clearAll() {
    return withStore('readwrite', (store) => {
      store.clear();
    });
  },

  async exportJson() {
    const rows = await this.getAllLogs();
    return JSON.stringify({ version: 1, exportedAt: Date.now(), logs: rows }, null, 2);
  },

  async importJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    const logs = Array.isArray(parsed) ? parsed : parsed.logs;
    if (!Array.isArray(logs)) throw new Error('Invalid file: no logs array found');
    return withStore('readwrite', (store) => {
      for (const row of logs) {
        const { timestamp, floor, small, large, user } = row;
        if (typeof timestamp === 'number' && typeof floor === 'number' &&
            typeof small === 'number' && typeof large === 'number') {
          store.add({ timestamp, floor, small, large, user: typeof user === 'string' && user ? user : 'Unknown' });
        }
      }
    });
  },
};
