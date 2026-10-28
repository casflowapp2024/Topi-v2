// service-worker.js
// - Navegaciones: network-first (la caché solo es respaldo offline).
// - /static/* (nombres con hash): cache-first.
// - Todo lo demás (API, otros orígenes, métodos != GET) va directo a la red.
// scripts/stamp-sw.js reemplaza __BUILD_ID__ en cada build: así el archivo cambia en cada deploy
// y el navegador instala la versión nueva.

const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `topi-v2-${BUILD_ID}`;
// Sin estampar = lo sirve el dev server (npm start). Ahí /static/js/bundle.js no lleva hash y el
// cache-first dejaría el navegador pegado a un bundle viejo (p. ej. el de otra rama): este SW solo
// limpia, se desregistra y recarga las ventanas.
const DEV = BUILD_ID.indexOf('__') === 0;
const SHELL_URL = '/index.html';
// Caché del SW de la versión anterior (cache-first de index.html). Si existe, hay que sacar a
// las ventanas abiertas de esa versión: su JS no escucha controllerchange.
const LEGACY_CACHES = ['topi-pwa-cache-v1'];

self.addEventListener('install', event => {
  if (DEV) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  if (DEV) {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(client => client.navigate(client.url).catch(() => undefined));
    })());
    return;
  }
  event.waitUntil((async () => {
    const names = await caches.keys();
    const hadLegacy = names.some(name => LEGACY_CACHES.includes(name));
    await Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
    if (hadLegacy) {
      const windows = await self.clients.matchAll({ type: 'window' });
      // Sin await: la navegación la atiende este mismo SW, que no recibe fetch hasta terminar de
      // activarse. Esperarla aquí dentro de waitUntil deja la activación (y la página) bloqueada.
      windows.forEach(client => client.navigate(client.url).catch(() => undefined));
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (DEV || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(SHELL_URL, { cacheName: CACHE_NAME });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}
