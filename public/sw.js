/* Only public local-first shells/assets are cached. Never cache API/auth responses. */
const CACHE = 'kopilka-local-v2';
const PAGES = ['/dashboard','/transactions','/accounts','/plan','/goals','/analytics','/profile','/assistant','/offline'];
const ASSETS = ['/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...PAGES, ...ASSETS]);
    // Warm hashed JS/CSS so an already-installed shell starts offline too.
    for (const page of PAGES) {
      const html = await (await cache.match(page)).text();
      const paths = [...new Set(html.match(/\/_next\/static\/[^"\s<>]+?\.(?:js|css)/g) || [])];
      await Promise.all(paths.map(path => cache.add(path).catch(() => undefined)));
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('kopilka-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/static/') || ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    })));
  } else if (request.mode === 'navigate' && (PAGES.includes(url.pathname) || url.pathname === '/')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(url.pathname, copy)); }
      return response;
    }).catch(async () => (await caches.match(url.pathname === '/' ? '/dashboard' : url.pathname)) || (await caches.match('/offline'))));
  }
});
