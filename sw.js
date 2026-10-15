// Network first, falling back to the cache, so the app still opens without
// Wi-Fi but always picks up the newest version when online.
const CACHE = 'animate-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/ui.js', 'js/camera.js', 'js/gif.js',
  'js/sheet.js', 'js/scanner.js', 'js/pdf.js',
  'js/screens/home.js', 'js/screens/capture.js', 'js/screens/play.js',
  'js/screens/scan.js', 'js/screens/sheets.js',
  'vendor/gifenc.esm.js', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
