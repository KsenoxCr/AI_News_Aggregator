const DB_NAME = "news_db";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("articles")) {
        const store = db.createObjectStore("articles", { keyPath: "id" });
        store.createIndex("source_published", ["source_id", "published_at"], {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains("etags")) {
        const store = db.createObjectStore("fetches", { keyPath: "etag" });
        store.createIndex("source", "source", { unique: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// TODO: Swap T with normalization libs return type

export function dbGet<T>(
  db: IDBDatabase,
  store: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

// upsert
export function dbPut<T>(
  db: IDBDatabase,
  store: string,
  value: T,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function dbGetByIndex<T>(
  db: IDBDatabase,
  store: string,
  index: string,
  range: IDBKeyRange,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).index(index).getAll(range);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}
