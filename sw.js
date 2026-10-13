/* Service worker: guarda a app em cache para funcionar sem internet.
   Aumenta CACHE_VERSION sempre que alterares ficheiros da app. */
const CACHE_VERSION = 'moto-banker-v8';

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
  // cache: 'reload' ignora a cache HTTP do browser: a nova versão nunca fica com ficheiros antigos misturados
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const NETWORK_TIMEOUT_MS = 3000;
const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve(null), ms));

/*
 * Páginas, código e estilos: rede primeiro (sempre a versão mais recente, sem misturar ficheiros
 * novos com antigos); sem rede ou com rede lenta, usa a cache.
 * Imagens das motas: cache primeiro (nunca mudam), atualizadas em segundo plano.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);
    event.waitUntil(network);

    if (url.pathname.includes('/img/') && cached) return cached;

    const response = await Promise.race([network, cached ? timeout(NETWORK_TIMEOUT_MS) : network]);
    if (response && response.ok) return response;
    if (cached) return cached;
    if (response) return response;
    if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
