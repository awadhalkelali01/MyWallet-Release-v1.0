const CACHE_NAME = "mywallet-cache-v2";

// الملفات التي سيتم تخزينها Offline
const ASSETS = [
  "index.html",
  "banks.html",
  "gold.html",
  "zakat.html",
  "debts.html",
  "settings.html",

  "style.css",
  "core_logic.js",
  "banks.js",
  "debts.js",
  "gold.js",
  "zakat.js",
  "settings.js",

  "icons/wallet-icon-192.png",
  "icons/wallet-icon-512.png"
];

// تثبيت الكاش لأول مرة
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// جلب الملفات من الكاش أولاً ثم الشبكة
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => {
      return (
        res ||
        fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          });
        })
      );
    })
  );
});

// تحديث الكاش عندما تصدر نسخة جديدة
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});


