# PWA Application

A Progressive Web Application (PWA) starter template with offline support, installability, and modern web features.

## Features

- **Installable**: Can be installed on devices for a native app experience
- **Offline Support**: Works offline with service worker caching
- **Fast**: Optimized performance with cached resources
- **Responsive**: Mobile-friendly design that works on all devices
- **Modern**: Built with modern web standards and best practices

## Project Structure

```
.
├── index.html          # Main HTML file
├── manifest.json       # Web App Manifest for installability
├── service-worker.js   # Service Worker for offline functionality
├── app.js             # Main application JavaScript
├── styles.css         # Application styles
├── icon-192x192.png   # App icon (192x192)
├── icon-512x512.png   # App icon (512x512)
├── package.json       # Project dependencies and scripts
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

### Testing PWA Features

To properly test PWA features like installation and offline mode:

1. **Use HTTPS or localhost**: PWAs require a secure connection
2. **Open Chrome DevTools**:
   - Go to Application tab
   - Check Service Workers section
   - Verify the service worker is registered
3. **Test offline mode**:
   - In DevTools Application tab, check "Offline"
   - Reload the page to verify offline functionality
4. **Test installation**:
   - Click the "Install App" button when it appears
   - Or use the browser's install prompt (usually in the address bar)

## Development

### Adding New Pages

1. Create your HTML file
2. Add the file path to the `urlsToCache` array in `service-worker.js`
3. Update the cache version if needed

### Modifying the Service Worker

When you make changes to the service worker:

1. Update the `CACHE_NAME` version in `service-worker.js`
2. The new service worker will install but wait to activate
3. Close all tabs of the app or use "skipWaiting" to force activation

### Customization

- **Colors**: Update theme colors in `manifest.json` and CSS variables in `styles.css`
- **Icons**: Replace `icon-192x192.png` and `icon-512x512.png` with your own icons
- **App Name**: Update the name in `manifest.json` and `index.html`
- **Cache Strategy**: Modify the fetch handler in `service-worker.js` for different caching strategies

## PWA Requirements Checklist

- [x] Web App Manifest
- [x] Service Worker
- [x] HTTPS (or localhost)
- [x] Responsive design
- [x] App icons (192x192 and 512x512)
- [x] Offline functionality
- [x] Install prompt handling

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Partial support (limited service worker features)
- Opera: Full support

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## License

MIT
