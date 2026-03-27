// Service Worker for Image Caching
// Cache strategy: Cache first, fallback to network

const CACHE_VERSION = 'v1';
const CACHE_NAME = `image-cache-${CACHE_VERSION}`;
const IMAGE_CACHE_SIZE = 300; // Max images to cache

// Install event - set up cache
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - intercept and cache images
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only cache GET requests for images
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  
  // Cache image files
  if (isImageUrl(url)) {
    event.respondWith(cacheImage(request));
  }
});

// Check if URL is an image
function isImageUrl(url) {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const pathname = url.pathname.toLowerCase();
  return imageExtensions.some(ext => pathname.endsWith(ext));
}

// Cache image with fallback
async function cacheImage(request) {
  try {
    // Try cache first
    const cached = await caches.match(request);
    if (cached) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cached;
    }

    // If not in cache, fetch from network
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response.status === 200 && response.type === 'basic') {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
        console.log('[Service Worker] Cached image:', request.url);
        
        // Clean up old cache if size exceeds limit
        cleanupCache();
      });
    }
    
    return response;
  } catch (error) {
    console.log('[Service Worker] Fetch failed, using fallback:', error);
    // Return a placeholder or cached version if available
    return caches.match(request);
  }
}

// Clean up cache if it exceeds size limit
async function cleanupCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  if (keys.length > IMAGE_CACHE_SIZE) {
    // Delete oldest entries (FIFO)
    const keysToDelete = keys.slice(0, keys.length - IMAGE_CACHE_SIZE);
    keysToDelete.forEach((key) => {
      cache.delete(key);
      console.log('[Service Worker] Removed cached image:', key.url);
    });
  }
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[Service Worker] Cache cleared');
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data.type === 'GET_CACHE_SIZE') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        event.ports[0].postMessage({ size: keys.length });
      });
    });
  }
});
