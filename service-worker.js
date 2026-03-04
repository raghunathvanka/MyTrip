/* ========================================
   Service Worker - Modern PWA Support
   ======================================== */

const CACHE_VERSION = 'v4.91.0'; // v105
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE_NAME = `${CACHE_VERSION}-data`;
const IMAGE_CACHE_NAME = `${CACHE_VERSION}-images`;

// Static assets to cache immediately
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './bundle.js', // RENAMED FROM APP.JS
    './storage.js',
    './ui-components.js',
    './charts.js',
    './reports.js',
    './manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Skip waiting');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== CACHE_NAME &&
                            cache !== DATA_CACHE_NAME &&
                            cache !== IMAGE_CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - smart caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // IGNORE NON-GET REQUESTS (POST, PUT, DELETE, etc.)
    if (request.method !== 'GET') {
        return;
    }

    // HTML - Network first, fallback to cache
    if (request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(response => response || caches.match('./index.html'));
                })
        );
        return;
    }

    // CSS/JS - Cache first, update in background
    if (request.destination === 'style' ||
        request.destination === 'script') {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    const fetchPromise = fetch(request)
                        .then(networkResponse => {
                            // Clone response BEFORE using it
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, responseToCache);
                            });
                            return networkResponse;
                        });
                    return response || fetchPromise;
                })
        );
        return;
    }

    // Images - Cache first
    if (request.destination === 'image') {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) return response;

                    return fetch(request)
                        .then(networkResponse => {
                            if (networkResponse.ok) {
                                caches.open(IMAGE_CACHE_NAME).then(cache => {
                                    cache.put(request, networkResponse.clone());
                                });
                            }
                            return networkResponse;
                        });
                })
        );
        return;
    }

    // Fonts - Cache first
    if (request.destination === 'font') {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) return response;

                    return fetch(request)
                        .then(networkResponse => {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, networkResponse.clone());
                            });
                            return networkResponse;
                        });
                })
        );
        return;
    }

    // Default - Network first
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(DATA_CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-trips') {
        event.waitUntil(
            // Sync logic here when backend is added
            Promise.resolve()
        );
    }
});

// Push notifications support
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: './icon-192.png',
        badge: './badge-72.png',
        vibrate: [200, 100, 200],
        tag: 'mytrip-notification',
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification('MyTrip', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('./')
    );
});

// Message handler for cache updates
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => caches.delete(cache))
                );
            })
        );
    }
});
