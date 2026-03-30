/**
 * offlineQueue.ts — IndexedDB-backed queue for offline verse reads.
 *
 * DB: lectio-offline v2
 * Store: pending_reads
 *   keyPath: 'id' (autoIncrement)
 *   Record: { id: number; verseIds: number[]; queuedAt: string; synced: boolean }
 *
 * Hard cap: 10,000 unsynced items. Writes beyond cap are dropped (dropped: true).
 * Synced items are kept in the store until clearSynced() is called.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lectio-offline';
const DB_VERSION = 2;
const STORE_NAME = 'pending_reads';
export const QUEUE_CAP = 10_000;

export interface PendingRead {
  id: number;
  verseIds: number[];
  queuedAt: string;
  synced: boolean;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 used autoIncrement without keyPath — drop and recreate
        if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Adds a batch of verse IDs to the offline queue.
 * Returns { id, dropped: false } on success, { id: -1, dropped: true } when cap is reached.
 */
export async function enqueueVerseReads(
  verseIds: number[],
): Promise<{ id: number; dropped: boolean }> {
  const db = await getDb();

  const all = (await db.getAll(STORE_NAME)) as PendingRead[];
  const unsyncedCount = all.filter((item) => !item.synced).length;

  if (unsyncedCount >= QUEUE_CAP) {
    return { id: -1, dropped: true };
  }

  const id = (await db.add(STORE_NAME, {
    verseIds,
    queuedAt: new Date().toISOString(),
    synced: false,
  })) as number;

  return { id, dropped: false };
}

/** Returns all unsynced pending reads. */
export async function getPendingReads(): Promise<PendingRead[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_NAME)) as PendingRead[];
  return all.filter((item) => !item.synced);
}

/** Marks the given IDB item IDs as synced. */
export async function markSynced(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const id of ids) {
    const item = (await store.get(id)) as PendingRead | undefined;
    if (item) {
      await store.put({ ...item, synced: true });
    }
  }
  await tx.done;
}

/** Deletes all items marked as synced. Call after a successful flush. */
export async function clearSynced(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const all = (await store.getAll()) as PendingRead[];
  for (const item of all) {
    if (item.synced) {
      await store.delete(item.id);
    }
  }
  await tx.done;
}
