// Network first, cache as the fallback: a phone that is online always gets the newest release the moment it is
// pushed, and an installed app still opens with no signal. The release number lives in version.js.
importScripts('./version.js');
const VERSION = self.HH_VERSION;
const CACHE = 'hh-shorts-' + VERSION;
const SHELL = ['./', './index.html', './about.html', './i18n.js', './version.js', './ui.css', './ui-dirs.css', './ui.js', './core.js', './looks.js', './beats.js', './media.js', './store.js',
  './manifest.webmanifest', './assets/icons/icon-192.png'];

// 10-19 영샘 S20+: the installed app kept opening the old release - GitHub Pages lets browsers keep files 10 minutes
// (max-age=600), and both the precache and the network-first fetch went through that HTTP cache. Now our own files are
// always revalidated with the server (a 304 when unchanged, so it stays cheap).
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  const own = new URL(req.url).origin === self.location.origin;
  // a navigate Request cannot take an init, so pages go by URL
  const net = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : own ? fetch(req, { cache: 'no-cache' }) : fetch(req);
  e.respondWith(net.then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
