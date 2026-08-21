/* Service worker for Web Push – works when app is closed (free, no paid service) */
self.addEventListener("install", function () {
  self.skipWaiting();
});

/* --- Offline outbox flush (Background Sync) ---------------------------------
 * Mirrors the IndexedDB schema in lib/outbox.ts (this file can't import that
 * module - service workers registered from /public are plain scripts, not
 * bundled). Keep DB_NAME/STORE_NAME and the record shape in sync with it.
 *
 * When the app queues a message it fails to send while offline, it also asks
 * the browser to fire a "sync" event once connectivity returns - even if the
 * app itself has since been closed. Only Chromium-based browsers support
 * Background Sync (no Safari/iOS); on unsupported browsers the app's own
 * foreground retry logic (on reopen / reconnect) is what sends the message.
 */
var OUTBOX_DB_NAME = "yappy-outbox";
var OUTBOX_STORE_NAME = "queued-messages";

function openOutboxDb() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(OUTBOX_DB_NAME, 1);
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE_NAME)) {
        db.createObjectStore(OUTBOX_STORE_NAME, { keyPath: "localId" });
      }
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

function claimNextQueuedMessage() {
  return openOutboxDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(OUTBOX_STORE_NAME, "readwrite");
      var store = tx.objectStore(OUTBOX_STORE_NAME);
      var request = store.getAll();
      request.onsuccess = function () {
        var all = request.result.sort(function (a, b) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        var next = all[0];
        if (!next) {
          resolve(null);
          return;
        }
        store.delete(next.localId);
        tx.oncomplete = function () {
          resolve(next);
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  });
}

function requeueMessage(item) {
  return openOutboxDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(OUTBOX_STORE_NAME, "readwrite");
      tx.objectStore(OUTBOX_STORE_NAME).put(item);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  });
}

function notifyClientsOutboxFlushed() {
  return self.clients.matchAll({ type: "window" }).then(function (clientList) {
    clientList.forEach(function (client) {
      client.postMessage({ type: "outbox-flushed" });
    });
  });
}

function flushOutbox() {
  return claimNextQueuedMessage().then(function processNext(item) {
    if (!item) {
      return notifyClientsOutboxFlushed();
    }
    var payload = {};
    Object.keys(item).forEach(function (key) {
      if (key !== "localId" && key !== "createdAt") payload[key] = item[key];
    });
    return fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        if (!response.ok) {
          // Server rejected it outright - drop it, retrying wouldn't help.
          return claimNextQueuedMessage().then(processNext);
        }
        return claimNextQueuedMessage().then(processNext);
      })
      .catch(function () {
        // Still offline - put it back for the next sync attempt and stop.
        return requeueMessage(item);
      });
  });
}

self.addEventListener("sync", function (event) {
  if (event.tag === "flush-outbox") {
    event.waitUntil(flushOutbox());
  }
});
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    return;
  }
  const title = data.title || "Yappy Notes";
  const options = {
    body: data.body || "New message",
    icon: data.icon || "/icon-192.png",
    badge: data.icon || "/icon-192.png",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        if (clientList.length > 0 && clientList[0].focus) {
          clientList[0].focus();
        } else if (clients.openWindow) {
          clients.openWindow("/");
        }
      })
  );
});
