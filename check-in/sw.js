// Bluzen check-in: offline copy.
// Keeps the check-in's own files on the phone so it opens with no signal.
// It only ever reads from this folder on the Bluzen site. It never sends anything anywhere,
// and nothing anyone types is stored here: the check-in keeps that in memory only.
// Change CACHE whenever any file in this folder changes, so phones fetch the new version.
const CACHE = 'bluzen-check-in-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bluzen-check-in-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page itself: try the network first so updates arrive, fall back to the saved copy offline.
// Everything else in this folder: the saved copy first, it's quicker.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
