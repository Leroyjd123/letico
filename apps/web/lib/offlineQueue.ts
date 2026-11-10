/**
 * offlineQueue.ts — IndexedDB-backed queue of reading changes not yet synced.
 *
 * DB: lectio-offline v3
 * Store: pending_reads (keyPath 'id', autoIncrement → items flush in order)
 *   Record: { id, op: 'mark' | 'unmark', verseIds, queuedAt, synced }
 *
 * v2 records have no `op`; they are treated as 'mark'.
 * `queuedAt` is sent as readAt so offline reads keep the time they happened.
 * Hard cap: 10,000 unsynced items. Writes beyond cap are dropped (dropped: true).
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lectio-offline';
const DB_VERSION = 3;
const STORE_NAME = 'pending_reads';
export const QUEUE_CAP = 10_000;

export type QueueOp = 'mark' | 'unmark';

export interface PendingRead {
  id: number;
  op: QueueOp;
  verseIds: number[];
  queuedAt: string;
  synced: boolean;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 used autoIncrement without keyPath — drop and recreate.
        if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        // v2 → v3: records gain `op`; handled at read time (default 'mark').
      },
    });
  }
  return dbPromise;
}

function normalise(item: Partial<PendingRead> & { id: number }): PendingRead {
  return {
    id: item.id,
    op: item.op ?? 'mark',
    verseIds: item.verseIds ?? [],
    queuedAt: item.queuedAt ?? new Date().toISOString(),
    synced: item.synced ?? false,
  };
}

/** Adds a change to the queue. Returns { dropped: true } when the cap is reached. */
export async function enqueue(
  op: QueueOp,
  verseIds: number[],
): Promise<{ id: number; dropped: boolean }> {
  const db = await getDb();
  const unsynced = await getPendingReads();
  if (unsynced.length >= QUEUE_CAP) return { id: -1, dropped: true };

  const id = (await db.add(STORE_NAME, {
    op,
    verseIds,
    queuedAt: new Date().toISOString(),
    synced: false,
  })) as number;
  return { id, dropped: false };
}

/** Back-compat alias used by older call sites/tests. */
export function enqueueVerseReads(verseIds: number[]) {
  return enqueue('mark', verseIds);
}

/** All unsynced items, oldest first. */
export async function getPendingReads(): Promise<PendingRead[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_NAME)) as Array<Partial<PendingRead> & { id: number }>;
  return all
    .map(normalise)
    .filter((item) => !item.synced)
    .sort((a, b) => a.id - b.id);
}

/** Removes the given items (synced, or permanently rejected by the server). */
export async function removeItems(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
}
