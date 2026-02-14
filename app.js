// Register Service Worker
let swRegistration = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
        swRegistration = registration;
        updateServiceWorkerStatus('Service Worker: Active ✓');

        // Check notification status after service worker is ready
        updateNotificationStatus();
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
        updateServiceWorkerStatus('Service Worker: Failed ✗');
      });
  });
} else {
  updateServiceWorkerStatus('Service Worker: Not supported');
}

// Update Service Worker status in UI
function updateServiceWorkerStatus(message) {
  const statusElement = document.getElementById('sw-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = message.includes('Active') ? 'status-success' : 'status-error';
  }
}

// Handle PWA installation
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event fired');
  // Prevent the mini-infobar from appearing
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show install button
  if (installBtn) {
    installBtn.style.display = 'block';
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      // Clear the deferredPrompt
      deferredPrompt = null;
      // Hide the install button
      installBtn.style.display = 'none';
    }
  });
}

// Handle successful installation
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed successfully');
  deferredPrompt = null;
  if (installBtn) {
    installBtn.style.display = 'none';
  }
});

// Check if app is already installed
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('App is running in standalone mode');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
}

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================

const notificationStatus = document.getElementById('notification-status');
const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
const sendNotificationBtn = document.getElementById('send-notification-btn');

// Check notification permission status
function updateNotificationStatus() {
  if (!('Notification' in window)) {
    notificationStatus.textContent = '❌ Notifications not supported in this browser';
    enableNotificationsBtn.disabled = true;
    return;
  }

  const permission = Notification.permission;
  if (permission === 'granted') {
    notificationStatus.textContent = '✅ Notifications enabled';
    enableNotificationsBtn.style.display = 'none';
    sendNotificationBtn.disabled = false;
  } else if (permission === 'denied') {
    notificationStatus.textContent = '❌ Notifications blocked. Enable in browser settings.';
    enableNotificationsBtn.disabled = true;
  } else {
    notificationStatus.textContent = '⚠️ Notifications not enabled';
    enableNotificationsBtn.disabled = false;
  }
}

// Request notification permission
if (enableNotificationsBtn) {
  enableNotificationsBtn.addEventListener('click', async () => {
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      updateNotificationStatus();

      if (permission === 'granted') {
        // Send a welcome notification using service worker
        await showNotification('PWA Notifications Enabled! 🎉', {
          body: 'You will now receive notifications from this app. Click to test!',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'welcome-notification',
          vibrate: [200, 100, 200],
          actions: [
            { action: 'explore', title: 'Explore App' },
            { action: 'close', title: 'Close' }
          ]
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      notificationStatus.textContent = '❌ Error enabling notifications';
    }
  });
}

// Helper function to show notification (uses service worker when available)
async function showNotification(title, options) {
  try {
    if ('serviceWorker' in navigator) {
      // Wait for an active service worker (required on mobile, more reliable everywhere)
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      console.log('Notification shown via Service Worker');
    } else {
      // Fallback to regular Notification API for browsers without service worker support
      const notification = new Notification(title, options);

      // Add click handler for regular notifications
      notification.onclick = function(event) {
        event.preventDefault();
        console.log('Notification clicked:', title);
        window.focus();
        notification.close();
      };

      console.log('Notification shown via Notification API');
    }
  } catch (error) {
    console.error('Error showing notification:', error);
    throw error;
  }
}

// Send test notification
if (sendNotificationBtn) {
  sendNotificationBtn.addEventListener('click', async () => {
    if (Notification.permission === 'granted') {
      const notifications = [
        {
          title: 'Test Notification 📱',
          body: 'This is a test notification from your PWA! Click me to interact.',
          data: { url: '/' }
        },
        {
          title: 'PWA Update 🚀',
          body: 'Check out the new features: Push Notifications & Storage!',
          data: { url: '/' }
        },
        {
          title: 'Reminder 🔔',
          body: 'PWAs can work offline, cache content, and send notifications!',
          data: { url: '/' }
        },
        {
          title: 'Storage Demo 💾',
          body: 'Your data is safely stored locally using IndexedDB!',
          data: { url: '/' }
        }
      ];

      const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];

      try {
        await showNotification(randomNotification.title, {
          body: randomNotification.body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'test-notification-' + Date.now(),
          requireInteraction: false,
          vibrate: [200, 100, 200],
          data: randomNotification.data,
          actions: [
            { action: 'open', title: 'Open App', icon: '/icon-192x192.png' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });

        // Update status
        notificationStatus.textContent = '✅ Test notification sent! Check your system tray.';
        notificationStatus.style.background = '#e8f5e9';

        setTimeout(() => {
          notificationStatus.textContent = '✅ Notifications enabled';
          notificationStatus.style.background = '#f0f0f0';
        }, 3000);

        console.log('Test notification sent successfully');
      } catch (error) {
        console.error('Error sending test notification:', error);
        notificationStatus.textContent = '❌ Error sending notification';
        notificationStatus.style.background = '#ffebee';
      }
    }
  });
}

// ==========================================
// LOCAL STORAGE
// ==========================================

const storageKey = document.getElementById('storage-key');
const storageValue = document.getElementById('storage-value');
const saveLocalBtn = document.getElementById('save-local-btn');
const loadLocalBtn = document.getElementById('load-local-btn');
const clearLocalBtn = document.getElementById('clear-local-btn');
const localStorageResult = document.getElementById('local-storage-result');

// Save to localStorage
if (saveLocalBtn) {
  saveLocalBtn.addEventListener('click', () => {
    const key = storageKey.value.trim();
    const value = storageValue.value.trim();

    if (key && value) {
      try {
        localStorage.setItem(key, value);
        localStorageResult.textContent = `✅ Saved: ${key} = "${value}"`;
        localStorageResult.style.borderColor = '#34a853';
        console.log('Saved to localStorage:', { key, value });
      } catch (error) {
        localStorageResult.textContent = `❌ Error: ${error.message}`;
        localStorageResult.style.borderColor = '#ea4335';
      }
    } else {
      localStorageResult.textContent = '⚠️ Please enter both key and value';
      localStorageResult.style.borderColor = '#fbbc04';
    }
  });
}

// Load from localStorage
if (loadLocalBtn) {
  loadLocalBtn.addEventListener('click', () => {
    const key = storageKey.value.trim();

    if (key) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        storageValue.value = value;
        localStorageResult.textContent = `✅ Loaded: ${key} = "${value}"`;
        localStorageResult.style.borderColor = '#34a853';
        console.log('Loaded from localStorage:', { key, value });
      } else {
        localStorageResult.textContent = `❌ Key "${key}" not found`;
        localStorageResult.style.borderColor = '#ea4335';
      }
    } else {
      localStorageResult.textContent = '⚠️ Please enter a key';
      localStorageResult.style.borderColor = '#fbbc04';
    }
  });
}

// Clear localStorage
if (clearLocalBtn) {
  clearLocalBtn.addEventListener('click', () => {
    const key = storageKey.value.trim();

    if (key) {
      localStorage.removeItem(key);
      localStorageResult.textContent = `✅ Cleared key: "${key}"`;
      localStorageResult.style.borderColor = '#34a853';
      storageValue.value = '';
      console.log('Cleared from localStorage:', key);
    } else {
      localStorageResult.textContent = '⚠️ Please enter a key to clear';
      localStorageResult.style.borderColor = '#fbbc04';
    }
  });
}

// ==========================================
// INDEXEDDB
// ==========================================

const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const clearTasksBtn = document.getElementById('clear-tasks-btn');
const tasksList = document.getElementById('tasks-list');
const indexedDBResult = document.getElementById('indexeddb-result');

let db;

// Initialize IndexedDB
function initIndexedDB() {
  const request = indexedDB.open('PWA_Database', 1);

  request.onerror = () => {
    console.error('IndexedDB error:', request.error);
    indexedDBResult.textContent = '❌ IndexedDB not available';
    indexedDBResult.style.borderColor = '#ea4335';
  };

  request.onsuccess = () => {
    db = request.result;
    console.log('IndexedDB initialized');
    loadTasks();
  };

  request.onupgradeneeded = (event) => {
    db = event.target.result;

    if (!db.objectStoreNames.contains('tasks')) {
      const objectStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
      objectStore.createIndex('text', 'text', { unique: false });
      objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      console.log('IndexedDB object store created');
    }
  };
}

// Add task to IndexedDB
function addTask(text) {
  const transaction = db.transaction(['tasks'], 'readwrite');
  const objectStore = transaction.objectStore('tasks');

  const task = {
    text: text,
    timestamp: new Date().toISOString()
  };

  const request = objectStore.add(task);

  request.onsuccess = () => {
    console.log('Task added to IndexedDB:', task);
    indexedDBResult.textContent = `✅ Task added: "${text}"`;
    indexedDBResult.style.borderColor = '#34a853';
    loadTasks();
  };

  request.onerror = () => {
    console.error('Error adding task:', request.error);
    indexedDBResult.textContent = '❌ Error adding task';
    indexedDBResult.style.borderColor = '#ea4335';
  };
}

// Load all tasks from IndexedDB
function loadTasks() {
  const transaction = db.transaction(['tasks'], 'readonly');
  const objectStore = transaction.objectStore('tasks');
  const request = objectStore.getAll();

  request.onsuccess = () => {
    const tasks = request.result;
    displayTasks(tasks);
  };

  request.onerror = () => {
    console.error('Error loading tasks:', request.error);
  };
}

// Display tasks in the UI
function displayTasks(tasks) {
  tasksList.innerHTML = '';

  if (tasks.length === 0) {
    tasksList.innerHTML = '<p style="padding: 10px; color: #666;">No tasks yet. Add one above!</p>';
    return;
  }

  tasks.forEach(task => {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.innerHTML = `
      <span>${task.text}</span>
      <button onclick="deleteTask(${task.id})">Delete</button>
    `;
    tasksList.appendChild(taskElement);
  });
}

// Delete a specific task
window.deleteTask = function(id) {
  const transaction = db.transaction(['tasks'], 'readwrite');
  const objectStore = transaction.objectStore('tasks');
  const request = objectStore.delete(id);

  request.onsuccess = () => {
    console.log('Task deleted:', id);
    indexedDBResult.textContent = '✅ Task deleted';
    indexedDBResult.style.borderColor = '#34a853';
    loadTasks();
  };

  request.onerror = () => {
    console.error('Error deleting task:', request.error);
    indexedDBResult.textContent = '❌ Error deleting task';
    indexedDBResult.style.borderColor = '#ea4335';
  };
};

// Clear all tasks
function clearAllTasks() {
  const transaction = db.transaction(['tasks'], 'readwrite');
  const objectStore = transaction.objectStore('tasks');
  const request = objectStore.clear();

  request.onsuccess = () => {
    console.log('All tasks cleared');
    indexedDBResult.textContent = '✅ All tasks cleared';
    indexedDBResult.style.borderColor = '#34a853';
    loadTasks();
  };

  request.onerror = () => {
    console.error('Error clearing tasks:', request.error);
    indexedDBResult.textContent = '❌ Error clearing tasks';
    indexedDBResult.style.borderColor = '#ea4335';
  };
}

// Event listeners for IndexedDB
if (addTaskBtn) {
  addTaskBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    if (text) {
      addTask(text);
      taskInput.value = '';
    } else {
      indexedDBResult.textContent = '⚠️ Please enter a task';
      indexedDBResult.style.borderColor = '#fbbc04';
    }
  });
}

if (clearTasksBtn) {
  clearTasksBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all tasks?')) {
      clearAllTasks();
    }
  });
}

// Initialize IndexedDB on load
if ('indexedDB' in window) {
  initIndexedDB();
} else {
  indexedDBResult.textContent = '❌ IndexedDB not supported';
  indexedDBResult.style.borderColor = '#ea4335';
  addTaskBtn.disabled = true;
  clearTasksBtn.disabled = true;
}
