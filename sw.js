const CACHE = 'kimu-task-v15';
const FILES = ['./','index.html','styles.css?v=14','detail.css?v=14','app.js?v=14','sync-refresh.js?v=14','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('activate', event => event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))])));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); return response; }).catch(()=>caches.match('./index.html')))));
