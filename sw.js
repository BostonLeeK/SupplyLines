// Supply Lines service worker: makes the game installable, keeps a copy of the app for flaky networks,
// and shows push notifications (your city is under attack, a launch needs your key, ...).
const CACHE = 'supply-lines-v3';
const SHELL = ['/', '/index.html', '/net.js', '/game/engine.js', '/manifest.json', '/icons/icon-192.png', '/icons/badge-96.png'];

// a shell that fails to download must not keep the old worker (and its old copy of the game) in charge
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// network first (the game updates often), cache as a fallback
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname === '/ws' || u.pathname.endsWith('.json') && u.pathname !== '/manifest.json') return;
  // offline: the saved copy of that file; only a page load may fall back to the saved game page, never a script
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'Supply Lines', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Supply Lines', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: d.tag || 'sl', renotify: true,
    data: { url: d.url || '/' }, vibrate: d.urgent ? [200, 100, 200, 100, 400] : [120],
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'focus', url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
