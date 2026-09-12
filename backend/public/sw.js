/* FleetVision AI Service Worker — cache-first untuk statik, network-first untuk navigasi */
const CACHE = 'fleetvision-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isBypass(req) {
  const url = new URL(req.url);
  // Jangan cache API, websocket, vite HMR, atau method non-GET
  if (req.method !== 'GET') return true;
  if (url.pathname.startsWith('/api')) return true;
  if (url.pathname.startsWith('/reverb') || url.pathname.startsWith('/app/')) return true;
  if (url.pathname.includes('@vite') || url.pathname.includes('@react-refresh')) return true;
  if (url.pathname.startsWith('/build/') && url.hostname.includes('localhost')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (isBypass(request)) return;

  // Navigasi halaman: network-first, fallback ke offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Aset statik: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          // Hanya cache response OK + basic/opaque
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
    )
  );
});
