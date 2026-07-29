const BUILD_VERSION = "__BUILD_VERSION__";
const SHELL_CACHE = `stone-shell-${BUILD_VERSION}`;
const RUNTIME_CACHE = `stone-runtime-${BUILD_VERSION}`;
const APP_BASE = new URL(self.registration.scope).pathname;
const inScope = (path) => new URL(path, self.registration.scope).toString();

const CORE_ASSETS = [
  inScope("./"),
  inScope("manifest.webmanifest"),
  inScope("icons/apple-touch-icon.png"),
  inScope("icons/pwa-192.png"),
  inScope("icons/pwa-512.png"),
  inScope("icons/pwa-maskable-512.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE_ASSETS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith("stone-") &&
                name !== SHELL_CACHE &&
                name !== RUNTIME_CACHE,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ??
            (await caches.match(inScope("./"))) ??
            Response.error()
          );
        }),
    );
    return;
  }

  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const refreshed = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached ?? Response.error());
        return cached ?? refreshed;
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) ?? Response.error()),
  );
});
