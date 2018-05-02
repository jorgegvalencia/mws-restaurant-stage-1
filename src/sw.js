const env = require ('./env.config.js');
const staticCacheName = `mws-static-${env.version}`;
const restaurantCoverImages = 'mws-restaurant-imgs';
const restaurantData = 'mws-restaurant-data';

// const API_KEY = 'AIzaSyDX0ubSeymjp0TknoQccasOYsu7Aacu2f4';
// `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=initMap`,

const allCaches = [
  staticCacheName,
  restaurantCoverImages,
  restaurantData
];

let cachedAssets = [
  'js/main.js',
  'js/restaurant_info.js',
  'css/styles.css'
];

if (env.prod) {
  cachedAssets = [
    'index.html',
    'restaurant.html',
    ...cachedAssets,
  ];
}

self.addEventListener('install', function(event) {
  const initCache = caches.open(staticCacheName).then(cache => {
    return cache.addAll(cachedAssets);
  });
  event.waitUntil(initCache);
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      const cacheCleanup = cacheNames
        .filter(cacheName => cacheName.startsWith('mws-') && !allCaches.includes(cacheName))
        .map(cacheName => caches.delete(cacheName));
      return Promise.all(cacheCleanup);
    })
  );
});

self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin === location.origin && env.prod) {
    if (requestUrl.pathname === '/') {
      return event.respondWith(caches.match('index.html'));
    }
    if (requestUrl.pathname.startsWith('/restaurant.html')) {
      return event.respondWith(caches.match('restaurant.html'));
    }
    if (requestUrl.pathname.endsWith('.jpg')){
      return event.respondWith(cachePhoto(event.request));
    }
  }

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

function cachePhoto (request) {
  var storageUrl = request.url;
  return caches.open(restaurantCoverImages).then(cache => {
    return cache.match(storageUrl).then(response => {
      if (response) return response;
      return fetch(request).then(networkResponse => {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}