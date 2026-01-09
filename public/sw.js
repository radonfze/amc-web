const CACHE_NAME = 'pryzo-cache-v1';
const STATIC_ASSETS = [
    '/login',
    '/tech',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    // Add other static assets here if needed, but Next.js handles many via build id
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API Caching (Network First, then Cache)
    if (url.pathname.startsWith('/api/technician')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone the response to store in cache
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // If network fails, try to serve from cache
                    return caches.match(event.request).then((response) => {
                        if (response) return response;
                        // Fallback?
                        return Promise.reject('no-cache');
                    });
                })
        );
        return;
    }

    // 2. Navigation Preload / HTML Caching (Stale-While-Revalidate or Network First)
    // For PWA pages, we want network first, fallback to cache for shell
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 3. Static Assets (Cache First)
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});
