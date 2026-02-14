// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
        updateServiceWorkerStatus('Service Worker: Active ✓');
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
