// Network first, falling back to the last cached copy, so the app opens with no signal.
const CACHE = 'forge-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.pathname.startsWith('/firebasejs/');
  if (e.request.method !== 'GET' || !(mine || fonts)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
