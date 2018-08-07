const DBHelper = require('./dbhelper');
const loadGoogleMapsApi = require('load-google-maps-api');

const gMapsOpts = {
  key: 'AIzaSyDX0ubSeymjp0TknoQccasOYsu7Aacu2f4',
  libraries: ['places']
};
const loc = {
  lat: 40.722216,
  lng: -73.987501
};
let isDynamicMapLoaded = false;

require('./polyfills');

let map, markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker().then(function() {
    if (window.matchMedia('(max-width:580px)').matches) {
      loadStaticMapImage();
      updateRestaurants();
    } else {
      loadDynamicMap().then(updateRestaurants);
    }
    fetchNeighborhoods().then(neighborhoods => {
      fillNeighborhoodsHTML(neighborhoods);
    });
    fetchCuisines().then(cuisines => {
      fillCuisinesHTML(cuisines);
    });
    document.getElementById('cuisines-select').addEventListener('change', onUserAction);
    document.getElementById('neighborhoods-select').addEventListener('change', onUserAction);
    document.getElementById('map').addEventListener('mouseover', onUserAction, {
      once: true
    });
    window.addEventListener('resize', onUserAction, {
      once: true
    });
    window.addEventListener('touchend', onUserAction, {
      once: true
    });
  });
});

const onUserAction = () => {
  loadDynamicMap().finally(updateRestaurants);
};

const initServiceWorker = () => {
  if (!navigator.serviceWorker) {
    return;
  }
  return navigator.serviceWorker.register('sw.js')
    .catch(console.error);
};

/**
 * Initialize Google map
 * Inmediately resolves if the map is already initialized
 */
const loadDynamicMap = (options = gMapsOpts) => {
  if (isDynamicMapLoaded) return Promise.resolve('Map already loaded');
  if (!navigator.onLine) {
    return Promise.reject('There is no connection');
  }
  isDynamicMapLoaded = true;
  return loadGoogleMapsApi(options).then(googleMaps => {
    map = new googleMaps.Map(document.getElementById('map'), {
      zoom: 12,
      center: loc,
      scrollwheel: false
    });
    return Promise.resolve(map);
  }).catch(function(err) {
    console.error(err);
    isDynamicMapLoaded = false;
  });
};

/**
 * Initialize Google map with a static image
 */
const loadStaticMapImage = () => {
  const browserWidth = window.innerWidth ||
    document.documentElement.clientWidth ||
    document.body.clientWidth;

  const mapHeight = '400'; // in px
  const staticMapUrl =
    'https://maps.googleapis.com/maps/api/staticmap?' +
    `center=${loc.lat},${loc.lng}&` +
    'zoom=12&' +
    'scale=3&' +
    `size=${browserWidth}x${mapHeight}&` +
    'maptype=roadmap&format=png&' +
    'visual_refresh=true&' +
    `key=${gMapsOpts.key}`;

  const staticMapImage =
    `<img width='${browserWidth}px' src=${encodeURI(staticMapUrl)} alt='Google Map image of Restaurants Area'>`;
  document.getElementById('map').innerHTML = staticMapImage;
};

/**
 * Fetch all neighborhoods and set their HTML.
 */
const fetchNeighborhoods = () => {
  return DBHelper.fetchNeighborhoods().catch(console.error);
};

/**
 * Set neighborhoods HTML.
 */
const fillNeighborhoodsHTML = (neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
const fetchCuisines = () => {
  return DBHelper.fetchCuisines().catch(console.error);
};

/**
 * Set cuisines HTML.
 */
const fillCuisinesHTML = (cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
const resetRestaurants = () => {
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  markers.forEach(m => m.setMap(null));
  markers = [];
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
const fillRestaurantsHTML = (restaurants) => {
  const ul = document.getElementById('restaurants-list');
  if (restaurants.length < 1) {
    ul.innerHTML = '<p>No results found</p>';
    return;
  }
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap(restaurants);
};

/**
 * Create restaurant HTML.
 */
const createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  const picture = document.createElement('picture');
  const imgSrc = DBHelper.imageUrlForRestaurant(restaurant);

  const source = document.createElement('source');
  source.sizes = '(min-width: 581px) 50vw, 100vw';
  source.srcset = `${imgSrc}-small.webp 500w, ${imgSrc}-medium.webp 800w`;
  source.type = 'image/webp';

  const image = document.createElement('img');
  image.className = 'restaurant-img';
  image.srcset = `${imgSrc}-small.jpg 500w, ${imgSrc}-medium.jpg 800w`;
  image.src = `${imgSrc}-medium.jpg`;
  image.alt = `Cover photo for ${restaurant.name}`;

  picture.append(source);
  picture.append(image);

  li.append(picture);

  const name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  more.setAttribute('role', 'button');
  more.setAttribute('aria-label', `View details of ${restaurant.name}`);
  li.append(more);

  return li;
};

/**
 * Add markers for current restaurants to the map.
 */
const addMarkersToMap = (restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    if (isDynamicMapLoaded) {
      const marker = DBHelper.mapMarkerForRestaurant(restaurant, map);
      google.maps.event.addListener(marker, 'click', () => {
        window.location.href = marker.url;
      });
      markers.push(marker);
    }
  });
};

/**
 * Update page and map for current restaurants.
 */
const updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood)
    .then(restaurants => {
      resetRestaurants();
      fillRestaurantsHTML(restaurants);
    })
    .catch(error => {
      console.error(error);
      const list = document.querySelector('#restaurants-list');
      list.innerHTML = 'No results found';
    });
};
