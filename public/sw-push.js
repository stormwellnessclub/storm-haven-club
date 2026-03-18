// Push notification service worker handler
// This file is loaded alongside the Vite PWA service worker

self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'default',
    data: {
      url: data.url || '/',
      conversationId: data.conversationId,
    },
    vibrate: [200, 100, 200],
    requireInteraction: data.urgent || false,
    actions: data.actions || [],
  };

  // For urgent/emergency messages, add urgency indicators
  if (data.urgent) {
    options.body = '🚨 ' + options.body;
    options.requireInteraction = true;
    options.vibrate = [300, 100, 300, 100, 300];
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Storm Wellness Club', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
