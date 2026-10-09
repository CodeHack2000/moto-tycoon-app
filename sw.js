/* Service worker: guarda a app em cache para funcionar sem internet.
   Aumenta CACHE_VERSION sempre que alterares ficheiros da app. */
const CACHE_VERSION = 'moto-banker-v5';

// Catálogo das motas (define MOTAS): as miniaturas também ficam disponíveis offline.
importScripts('./data/motas.js');

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data/motas.js',
  './regras.html',
  './vendor/html5-qrcode.min.js',
  './manifest.webmanifest',
  './icon.svg',
  ...MOTAS.map((m) => `./${m.imagem}`),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: responde logo da cache e atualiza em segundo plano quando há rede.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const response = await network;
    if (response) return response;
    if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
