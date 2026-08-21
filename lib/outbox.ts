/**
 * Offline outbox: persists not-yet-sent messages in IndexedDB so they survive
 * the app being closed and reopened (unlike React state or an in-memory queue).
 *
 * The schema here (db name, store name, record shape) is mirrored in public/sw.js
 * so the service worker can flush the same queue from a Background Sync event
 * while the app itself is closed. Keep the two in sync if this changes.
 */

export interface QueuedMessage {
  localId: string; // matches the optimistic message's temp id in the UI
  senderUserId: string;
  text?: string | null;
  imageBase64?: string | null;
  audioBase64?: string | null;
  audioMimeType?: string | null;
  replyToMessageId?: string;
  createdAt: string; // ISO string, used to send queued messages in order
}

const DB_NAME = "yappy-outbox";
const STORE_NAME = "queued-messages";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueMessage(message: QueuedMessage): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(message);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as QueuedMessage[]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      );
    request.onerror = () => reject(request.error);
  });
}

/**
 * Atomically pops the oldest queued message (get + delete in one transaction).
 * Using claim-then-send instead of send-then-delete means if the page and the
 * service worker both try to flush at once, only one of them can claim a given
 * message - the other finds it already gone, so it can't be sent twice.
 * Call `enqueueMessage` again to put it back if sending it fails.
 */
export async function claimNextQueuedMessage(): Promise<QueuedMessage | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = (request.result as QueuedMessage[]).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const next = all[0];
      if (!next) {
        resolve(null);
        return;
      }
      store.delete(next.localId);
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedMessage(localId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
