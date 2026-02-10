/* Service worker for Web Push – works when app is closed (free, no paid service) */
self.addEventListener("install", function () {
  self.skipWaiting();
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
