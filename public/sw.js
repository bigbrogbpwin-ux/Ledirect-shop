self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("ledirect-v1").then((cache) => cache.addAll(["/", "/icon.svg"])));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api") || url.pathname.startsWith("/admin")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
