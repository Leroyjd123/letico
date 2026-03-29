/**
 * offlineQueue.ts — IndexedDB-backed queue for offline verse reads.
 *
 * When navigator.onLine is false, useVerseRead writes verse IDs here
 * instead of calling the API. On reconnect, flushOfflineQueue replays them.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lectio-offline';
const STORE_NAME = 'pending_reads';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueForOffline(verseIds: number[]): Promise<void> {
  const db = await getDb();
  await db.add(STORE_NAME, { verseIds, queuedAt: Date.now() });
}

export async function flushOfflineQueue(
  markFn: (ids: number[]) => Promise<void>,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const allKeys = await store.getAllKeys();
  const allItems = await store.getAll();

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i] as { verseIds: number[] };
    const key = allKeys[i];
    try {
      await markFn(item.verseIds);
      await store.delete(key as IDBValidKey);
    } catch {
      // Keep in queue if flush fails — will retry next time
    }
  }

  await tx.done;
}
