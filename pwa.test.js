const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname);

// Helper: read a file relative to project root
function readFile(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf-8');
}

// Helper: check if a file exists relative to project root
function fileExists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

// ==========================================
// 1. All referenced files actually exist
// ==========================================

describe('File existence', () => {
  const expectedFiles = [
    'index.html',
    'styles.css',
    'app.js',
    'service-worker.js',
    'manifest.json',
    'icon-192x192.png',
    'icon-512x512.png',
  ];

  for (const file of expectedFiles) {
    it(`${file} exists`, () => {
      assert.ok(fileExists(file), `Missing file: ${file}`);
    });
  }
});

// ==========================================
// 2. No absolute paths (the GitHub Pages bug)
// ==========================================

describe('No absolute paths (GitHub Pages compatibility)', () => {
  const filesToCheck = [
    'index.html',
    'app.js',
    'service-worker.js',
  ];

  // Matches href="/...", src="/...", or string literals like '/something.js'
  // but ignores URLs with :// (like https://...) and lone '/' characters
  const absolutePathPattern = /(?:href|src|url)\s*[:=]\s*["']\/(?!\/)[^"']+["']/g;

  for (const file of filesToCheck) {
    it(`${file} has no absolute resource paths`, () => {
      const content = readFile(file);
      const matches = content.match(absolutePathPattern);
      assert.equal(
        matches,
        null,
        `Found absolute paths in ${file}: ${JSON.stringify(matches)}`
      );
    });
  }

  it('service-worker.js cache list uses relative paths', () => {
    const content = readFile('service-worker.js');
    const cacheListMatch = content.match(/urlsToCache\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(cacheListMatch, 'urlsToCache array not found in service-worker.js');

    const entries = cacheListMatch[1].match(/'[^']+'/g) || [];
    for (const entry of entries) {
      const val = entry.replace(/'/g, '');
      assert.ok(
        val.startsWith('./'),
        `Cache entry ${entry} should start with "./" but doesn't`
      );
    }
  });
});

// ==========================================
// 3. manifest.json validation
// ==========================================

describe('manifest.json', () => {
  let manifest;

  it('is valid JSON', () => {
    manifest = JSON.parse(readFile('manifest.json'));
  });

  it('has required PWA fields', () => {
    assert.ok(manifest.name, 'Missing "name"');
    assert.ok(manifest.short_name, 'Missing "short_name"');
    assert.ok(manifest.start_url, 'Missing "start_url"');
    assert.ok(manifest.display, 'Missing "display"');
    assert.ok(manifest.icons?.length > 0, 'Missing "icons"');
  });

  it('start_url is relative', () => {
    assert.ok(
      !manifest.start_url.startsWith('/') || manifest.start_url === './',
      `start_url "${manifest.start_url}" should be relative`
    );
  });

  it('icon paths are relative', () => {
    for (const icon of manifest.icons) {
      assert.ok(
        icon.src.startsWith('./'),
        `Icon src "${icon.src}" should start with "./"`
      );
    }
  });

  it('icon files exist on disk', () => {
    for (const icon of manifest.icons) {
      const iconPath = icon.src.replace('./', '');
      assert.ok(fileExists(iconPath), `Icon file missing: ${iconPath}`);
    }
  });

  it('has valid display mode', () => {
    const validModes = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];
    assert.ok(
      validModes.includes(manifest.display),
      `Invalid display mode: "${manifest.display}"`
    );
  });
});

// ==========================================
// 4. Service worker cache matches real files
// ==========================================

describe('Service worker cache list', () => {
  it('every cached URL corresponds to a real file', () => {
    const content = readFile('service-worker.js');
    const cacheListMatch = content.match(/urlsToCache\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(cacheListMatch, 'urlsToCache not found');

    const entries = (cacheListMatch[1].match(/'([^']+)'/g) || [])
      .map(e => e.replace(/'/g, ''));

    for (const entry of entries) {
      if (entry === './') continue; // root path maps to index.html
      const filePath = entry.replace('./', '');
      assert.ok(fileExists(filePath), `Cached file missing on disk: ${entry}`);
    }
  });
});

// ==========================================
// 5. HTML ↔ JS element ID consistency
// ==========================================

describe('HTML/JS element ID consistency', () => {
  // IDs that app.js references via getElementById
  const expectedIds = [
    'sw-status',
    'install-btn',
    'notification-status',
    'enable-notifications-btn',
    'send-notification-btn',
    'storage-key',
    'storage-value',
    'save-local-btn',
    'load-local-btn',
    'clear-local-btn',
    'local-storage-result',
    'task-input',
    'add-task-btn',
    'clear-tasks-btn',
    'tasks-list',
    'indexeddb-result',
  ];

  const html = readFile('index.html');

  for (const id of expectedIds) {
    it(`element #${id} exists in HTML`, () => {
      assert.ok(
        html.includes(`id="${id}"`),
        `Element with id="${id}" not found in index.html`
      );
    });
  }
});

// ==========================================
// 6. HTML references match files
// ==========================================

describe('HTML resource references', () => {
  const html = readFile('index.html');

  it('references app.js', () => {
    assert.ok(html.includes('./app.js'), 'index.html should reference ./app.js');
  });

  it('references styles.css', () => {
    assert.ok(html.includes('./styles.css'), 'index.html should reference ./styles.css');
  });

  it('references manifest.json', () => {
    assert.ok(html.includes('./manifest.json'), 'index.html should reference ./manifest.json');
  });

  it('references service worker registration in app.js', () => {
    const appJs = readFile('app.js');
    assert.ok(
      appJs.includes("register('./service-worker.js')"),
      'app.js should register ./service-worker.js'
    );
  });
});

// ==========================================
// 7. Service worker event handlers
// ==========================================

describe('Service worker structure', () => {
  const sw = readFile('service-worker.js');

  it('handles install event', () => {
    assert.ok(sw.includes("addEventListener('install'"), 'Missing install handler');
  });

  it('handles activate event', () => {
    assert.ok(sw.includes("addEventListener('activate'"), 'Missing activate handler');
  });

  it('handles fetch event', () => {
    assert.ok(sw.includes("addEventListener('fetch'"), 'Missing fetch handler');
  });

  it('handles push event', () => {
    assert.ok(sw.includes("addEventListener('push'"), 'Missing push handler');
  });

  it('handles notificationclick event', () => {
    assert.ok(sw.includes("addEventListener('notificationclick'"), 'Missing notificationclick handler');
  });

  it('calls skipWaiting in install', () => {
    assert.ok(sw.includes('skipWaiting()'), 'Missing skipWaiting() call');
  });

  it('calls clients.claim in activate', () => {
    assert.ok(sw.includes('clients.claim()'), 'Missing clients.claim() call');
  });
});
