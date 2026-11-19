/* SANA offline worker.
   Change VERSION on every release: phones then fetch the new files once and drop the old cache. */
const VERSION = 'sana-2026-11-19-3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/Pretendard-Regular.subset.woff2',
  './fonts/Pretendard-Medium.subset.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './card/photo.webp',
  './device/hover.mp4',
  './device/hover-poster.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    /* the page: a fresh copy when the network answers within 2.5s, otherwise the saved one
       (so a weak exhibition Wi-Fi never leaves the app hanging) */
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req).then((res) => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      });
      event.waitUntil(net.catch(() => {}));
      try {
        const res = await Promise.race([
          net,
          new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 2500))
        ]);
        if (res && res.ok) return res;
      } catch (e) { /* offline or slow: use the saved page */ }
      return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
    })());
    return;
  }

  /* fonts, icons, manifest: saved copy first, network once, then keep it */
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
