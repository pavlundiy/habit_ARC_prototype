const CACHE_VERSION = "habit-pwa-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app-shell.html",
  "./manifest.webmanifest",
  "./pwa-icon-192.png",
  "./pwa-icon-512.png",
  "./analytics/store.js",
  "./analytics/app-core.js",
  "./analytics/ui-feedback.js",
  "./analytics/runtime-browser-v2.js",
  "./analytics/navigation.js",
  "./analytics/screen-dom.js",
  "./analytics/screen-view-models.js",
  "./analytics/export-utils-v2.js",
  "./analytics/gemini-client.js",
  "./analytics/ai-review-store-v2.js",
  "./imported-designs/habit_tracker_live.html",
  "./imported-designs/habit_diary_live.html",
  "./imported-designs/insights_screen_connected.html",
  "./imported-designs/profile_live.html",
  "./imported-designs/ai_review_live.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./app-shell.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
