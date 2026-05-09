const CACHE_NAME = "household-stock-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/chibi_inventory_icons/Arte/Arte_04_waving.png",
  "./assets/chibi_inventory_icons/Arte/Arte_06_carrying_supplies_box.png",
  "./assets/chibi_inventory_icons/Arte/Arte_09_carrying_basket.png",
  "./assets/chibi_inventory_icons/Arte/Arte_13_clipboard_done.png",
  "./assets/chibi_inventory_icons/Couple/Couple_01_clipboard_together.png",
  "./assets/chibi_inventory_icons/Risol/Risol_02_smug_pose.png",
  "./assets/chibi_inventory_icons/Risol/Risol_07_thinking.png",
  "./assets/chibi_inventory_icons/Risol/Risol_08_carrying_box.png",
  "./assets/chibi_inventory_icons/Risol/Risol_10_stop_warning.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS.filter(Boolean)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Google APIs: network only
  if (event.request.url.includes("googleapis.com") || event.request.url.includes("accounts.google.com")) {
    return;
  }

  if (event.request.mode === "navigate" || event.request.destination === "style" || event.request.destination === "script") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
