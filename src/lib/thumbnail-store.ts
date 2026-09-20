const DB_NAME = 'tiles-view';
const DB_VERSION = 1;
const STORE = 'thumbnails';
const MAX_ENTRIES = 300;

export interface ThumbnailRecord {
  tabId: number;
  url: string;
  blob: Blob;
  capturedAt: number;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'tabId' });
        store.createIndex('capturedAt', 'capturedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putThumbnail(record: ThumbnailRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await evictIfNeeded();
}

export async function getThumbnail(tabId: number): Promise<ThumbnailRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const result = await promisify(tx.objectStore(STORE).get(tabId));
  return result as ThumbnailRecord | undefined;
}

export async function getAllThumbnails(): Promise<Map<number, ThumbnailRecord>> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const records = (await promisify(tx.objectStore(STORE).getAll())) as ThumbnailRecord[];
  return new Map(records.map((record) => [record.tabId, record]));
}

export async function deleteThumbnail(tabId: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(tabId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Drops the oldest captures once the store exceeds MAX_ENTRIES. */
async function evictIfNeeded(): Promise<void> {
  const db = await openDb();
  const countTx = db.transaction(STORE, 'readonly');
  const count = await promisify(countTx.objectStore(STORE).count());
  if (count <= MAX_ENTRIES) return;

  const excess = count - MAX_ENTRIES;
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.objectStore(STORE).index('capturedAt');
  let removed = 0;
  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || removed >= excess) {
        resolve();
        return;
      }
      cursor.delete();
      removed += 1;
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

/** Removes records for tabs that no longer exist. */
export async function pruneMissingTabs(liveTabIds: Set<number>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const keys = (await promisify(store.getAllKeys())) as number[];
  for (const key of keys) {
    if (!liveTabIds.has(key)) store.delete(key);
  }
}
