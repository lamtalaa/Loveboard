self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existingClient = clientsArr.find((client) => 'focus' in client);
      if (existingClient) {
        return existingClient.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { body: event.data.text() };
    }
  }
  const title = data.title || 'Loveboard';
  const options = {
    body: data.body || 'Open Loveboard to see what changed ❤️',
    icon: data.icon || './assets/heart.svg',
    badge: data.badge || './assets/heart.svg'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
