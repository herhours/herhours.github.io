// Network first, cache as the fallback: a phone that is online always gets the newest release the moment it is
// pushed, and an installed app still opens with no signal. The release number lives in version.js.
importScripts('./version.js');
const VERSION = self.HH_VERSION;
const CACHE = 'hh-shorts-' + VERSION;
const SHELL = ['./', './index.html', './about.html', './i18n.js', './version.js', './ui.css', './ui.js', './core.js', './looks.js', './beats.js', './media.js',
  './manifest.webmanifest', './assets/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hh-shorts-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});


self.addEventListener('fetch', (e) => {
  const req = e.request;
  // <audio> seeks with Range requests; a 206 cannot be cached, so let those go straight to the network.
  if (req.method !== 'GET' || req.headers.has('range') || !req.url.startsWith('http')) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
