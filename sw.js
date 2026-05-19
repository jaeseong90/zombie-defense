// Dead Corridor — service worker
// Strategy: network-first for HTML (so updates roll out fast), cache-first for static + CDN libs.

const VERSION = 'dc-v3';
const CORE = [
  '/',
  '/index.html',
  '/game.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isCDN = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com';
  const isSameOrigin = url.origin === self.location.origin;

  if (isHTML) {
    // Network-first for HTML — fall back to cache offline.
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  if (isSameOrigin || isCDN) {
    // Cache-first for everything else.
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
      })
    );
  }
});
