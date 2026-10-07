/* Cache only public local-first shells. Scope isolates project-site caches. */
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const CACHE = `kopilka-local-v5-${BASE}`;
const route = (name) => `${BASE}/${name}${BASE ? "/" : ""}`;
const PAGES = [
  "dashboard",
  "transactions",
  "accounts",
  "plan",
  "goals",
  "analytics",
  "profile",
  "assistant",
  "offline",
].map(route);
const ASSETS = [
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
].map((p) => BASE + p);
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...PAGES, ...ASSETS]);
      for (const page of PAGES) {
        const html = await (await cache.match(page)).text();
        const paths = [
          ...new Set(
            html.match(/\/_next\/static\/[^"\s<>]+?\.(?:js|css)/g) || [],
          ),
        ];
        await Promise.all(
          paths.map((p) => cache.add(BASE + p).catch(() => undefined)),
        );
      }
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("kopilka-") &&
              key !== CACHE &&
              (key.endsWith(`-${BASE}`) || (!BASE && !key.includes("/"))),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith(`${BASE}/_next/static/`) ||
    ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  } else if (request.mode === "navigate") {
    const normalized = BASE
      ? url.pathname.replace(/\/$/, "") + "/"
      : url.pathname.replace(/\/$/, "");
    const target =
      normalized === `${BASE}/` || normalized === BASE
        ? route("dashboard")
        : normalized;
    if (!PAGES.includes(target)) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(target, copy));
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match(target)) ||
            (await caches.match(route("offline"))),
        ),
    );
  }
});
