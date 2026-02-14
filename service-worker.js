const CACHE_NAME = 'pwa-app-v6';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch((error) => {
          console.log('Service Worker: Fetch failed', error);
          // You can return a custom offline page here
        });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'PWA Notification',
    body: 'You have a new notification!',
    icon: './icon-192x192.png',
    badge: './icon-192x192.png',
    tag: 'pwa-notification',
    requireInteraction: false
  };

  // If push event has data, use it
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.url ? { url: data.url } : {}
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data
    })
  );
});

// Helper: send a message to all open app windows
function postMessageToClients(message) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage(message);
      });
      return clientList;
    });
}

// Helper: focus or open the app window
function focusOrOpenApp(clientList, url) {
  for (const client of clientList) {
    if (client.url.includes(self.registration.scope) && 'focus' in client) {
      return client.focus();
    }
  }
  if (clients.openWindow) {
    return clients.openWindow(url);
  }
}

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  console.log('Action clicked:', event.action);

  const data = event.notification.data || {};
  event.notification.close();

  // Handle dismiss/close — just close the notification
  if (event.action === 'dismiss' || event.action === 'close') {
    return;
  }

  // Handle snooze action — tell the client to reschedule the reminder
  if (event.action === 'snooze' && data.taskId) {
    event.waitUntil(
      postMessageToClients({
        action: 'snooze',
        taskId: data.taskId,
        snoozeMinutes: data.snoozeMinutes || 5
      }).then((clientList) => {
        // Show a confirmation notification
        self.registration.showNotification('Snoozed ⏰', {
          body: `"${data.taskText || 'Task'}" — reminder in ${data.snoozeMinutes || 5} min`,
          icon: './icon-192x192.png',
          badge: './icon-192x192.png',
          tag: 'snooze-confirm-' + data.taskId,
          requireInteraction: false
        });
        return focusOrOpenApp(clientList, data.url || './');
      })
    );
    return;
  }

  // Handle complete action — tell the client to mark the task done
  if (event.action === 'complete' && data.taskId) {
    event.waitUntil(
      postMessageToClients({
        action: 'complete',
        taskId: data.taskId
      }).then((clientList) => {
        self.registration.showNotification('Task Completed ✅', {
          body: `"${data.taskText || 'Task'}" marked as done`,
          icon: './icon-192x192.png',
          badge: './icon-192x192.png',
          tag: 'complete-confirm-' + data.taskId,
          requireInteraction: false
        });
        return focusOrOpenApp(clientList, data.url || './');
      })
    );
    return;
  }

  // Default click — open/focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        return focusOrOpenApp(clientList, data.url || './');
      })
      .catch((error) => {
        console.error('Error handling notification click:', error);
      })
  );
});
