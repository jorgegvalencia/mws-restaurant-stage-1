const DBHelper = require('./dbhelper');
const loadScripts = require('./utils/loadscripts');

require('./polyfills');

let map,
  markers = [],
  restaurantsList = [],
  neighborhoodsList = [],
  cuisinesList = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker().then(function() {
    fetchNeighborhoods();
    fetchCuisines();
    if (navigator.onLine) {
      window.loadMap(function() {
        // will trigger initMap
      }, function() {
        window.updateRestaurants();
      });
    } else {
      self.updateRestaurants();
    }
  });
});

const registerServiceWorker = () => {
  if (!navigator.serviceWorker) {
    return;
  }
  return navigator.serviceWorker.register('sw.js')
    .catch(console.error);
};

/**
 * Fetch all neighborhoods and set their HTML.
 */
const fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      neighborhoodsList = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
const fillNeighborhoodsHTML = (neighborhoods = neighborhoodsList) => {
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
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      cuisinesList = cuisines;
      fillCuisinesHTML();
    }
  });
};

/**
 * Set cuisines HTML.
 */
const fillCuisinesHTML = (cuisines = cuisinesList) => {
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
const resetRestaurants = (restaurants) => {
  // Remove all restaurants
  restaurantsList = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  markers.forEach(m => m.setMap(null));
  markers = [];
  restaurantsList = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
const fillRestaurantsHTML = (restaurants = restaurantsList) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
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
const addMarkersToMap = (restaurants = restaurantsList) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    if (window.google) {
      const marker = DBHelper.mapMarkerForRestaurant(restaurant, map);
      google.maps.event.addListener(marker, 'click', () => {
        window.location.href = marker.url;
      });
      markers.push(marker);
    }
  });
};

window.loadMap = (success, fail) => {
  const API_KEY = 'AIzaSyDX0ubSeymjp0TknoQccasOYsu7Aacu2f4';
  const mapScript = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=initMap`;
  loadScripts([mapScript], success, fail);
};

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  window.updateRestaurants();
};

/**
 * Update page and map for current restaurants.
 */
window.updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  });
};
