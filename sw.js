// Blake's Animal World - Service Worker
// Cache-first for the app shell, opportunistic caching for everything else.
// Bump CACHE_VERSION when you ship a new index.html so old caches get evicted.

var CACHE_VERSION = 'baw-v2';
var SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Install: pre-cache the shell. addAll is all-or-nothing,
// so we use individual put()s with catch so a single 404 doesn't fail install.
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return Promise.all(SHELL_ASSETS.map(function(url) {
        return fetch(url, { cache: 'reload' }).then(function(resp) {
          if (resp && resp.ok) return cache.put(url, resp);
        }).catch(function() { /* skip missing assets */ });
      }));
    })
  );
  self.skipWaiting();
});

// Activate: clear out old cache versions
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch:
//   - GET only (don't cache POST/PUT/etc)
//   - Network-first for the HTML doc so updates show up fast
//   - Cache-first for everything else (icons, fonts, images)
//   - Offline fallback to cached index.html for navigation requests
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var isNav = e.request.mode === 'navigate' ||
              (e.request.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isNav) {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_VERSION).then(function(c) { c.put(e.request, clone); });
        return resp;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
          var clone = resp.clone();
          caches.open(CACHE_VERSION).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function() { /* offline, no cached match */ });
    })
  );
});
