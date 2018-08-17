const DBHelper = require('./dbhelper');
const loadGoogleMapsApi = require('load-google-maps-api');
let isDynamicMapLoaded = false;
let map, restaurant;
let _username = document.querySelector('#username');
let _rating = document.querySelector('#rating');
let _comments = document.querySelector('#comment');

const gMapsOpts = {
  key: 'AIzaSyDX0ubSeymjp0TknoQccasOYsu7Aacu2f4',
  libraries: ['places']
};

document.addEventListener('DOMContentLoaded', () => {
  fetchRestaurantFromURL().then(restaurant => {

    const whenPendingReviewsRead = DBHelper.readRestaurantPendingReviews(restaurant.id);

    fillBreadcrumb(restaurant);
    fillRestaurantHTML(restaurant);

    if (window.matchMedia('(max-width:580px)').matches) {
      loadStaticMapImage(restaurant);
    } else {
      loadDynamicMap(gMapsOpts, restaurant).then(map => {
        DBHelper.mapMarkerForRestaurant(restaurant, map);
      });
    }

    document.getElementById('map').addEventListener('mouseover', onUserAction, { once: true });
    document.getElementById('new-review-form').addEventListener('submit', onReviewUpload);
    window.addEventListener('resize', onUserAction, { once: true });
    window.addEventListener('touchend', onUserAction, { once: true });

    // try to sync all the reviews
    whenPendingReviewsRead.then(_pendingReviews => {
      // try to send the updates
      const whenPendingUpdates = _pendingReviews.map( _pendingReview => {
        return DBHelper.createRestaurantReview(_pendingReview.restaurant_id, _pendingReview);
      });
      return Promise.all(whenPendingUpdates).catch(err => {
        console.error(err);
        return Promise.resolve(); // continue the initialization
      });
    }).then(() => {
      DBHelper.fetchRestaurantReviews(restaurant.id).then(reviews => {
        restaurant.reviews = reviews;
        fillReviewsHTML(reviews);
      }).catch(function(err) {
        console.error(err);
      });
    });

  })
    .catch(console.error);
});

const onUserAction = () => {
  if (!isDynamicMapLoaded) loadDynamicMap(gMapsOpts, restaurant);
};

const onReviewUpload = (e) => {
  e.preventDefault();
  const name = _username.value;
  const rating = _rating.value;
  const comments = _comments.value;
  const review = {
    id: '',
    name,
    rating,
    comments
  };
  console.debug(_username, _rating, comments);
  DBHelper.createRestaurantReview(restaurant.id, review).then(_review => {
    console.debug('Review created');
    // TODO: clear form fields
    let newReview = Object.assign(review, _review);
    restaurant.reviews.push(newReview);
    fillReviewsHTML(restaurant.reviews);
  }).catch(err => {
    console.error(err);
  });
};

/**
 * Initialize Google map
 */
const loadDynamicMap = (options = gMapsOpts, restaurant) => {
  if (isDynamicMapLoaded) return Promise.resolve('Map already loaded');
  if (!navigator.onLine) {
    return Promise.reject('There is no connection');
  }
  isDynamicMapLoaded = true;
  return loadGoogleMapsApi(options).then(googleMaps => {
    map = new googleMaps.Map(document.getElementById('map'), {
      zoom: 16,
      center: restaurant.latlng,
      scrollwheel: false
    });
    return Promise.resolve(map);
  })
    .catch(function(err) {
      console.error(err);
      isDynamicMapLoaded = false;
    });
};

/**
 * Initialize Google map with a static image
 */
const loadStaticMapImage = (restaurant) => {
  const browserWidth = window.innerWidth ||
    document.documentElement.clientWidth ||
    document.body.clientWidth;
  const center = {
    lat: restaurant.latlng.lat,
    lng: restaurant.latlng.lng
  };
  const mapHeight = '350'; // in px
  const staticMapUrl =
    'https://maps.googleapis.com/maps/api/staticmap?' + 
    `center=${center.lat},${center.lng}&` +
    'zoom=16&' +
    'scale=3&' +
    `size=${browserWidth}x${mapHeight}&` +
    'maptype=roadmap&format=png&' +
    'visual_refresh=true&' +
    `key=${gMapsOpts.key}`;

  const staticMapImage =
    `<img width='${browserWidth}px' src=${encodeURI(staticMapUrl)} alt='Google Map image of ${restaurant.name}'>`;
  document.getElementById('map').innerHTML = staticMapImage;
};

/**
 * Get current restaurant from page URL.
 */
var fetchRestaurantFromURL = () => {
  return new Promise((resolve, reject) => {
    if (restaurant) { // restaurant already fetched!
      return resolve(restaurant);
    }
    const id = getParameterByName('id');
    if (!id) { // no id found in URL
      return reject('No restaurant id in URL');
    }
    DBHelper.fetchRestaurantById(id).then(_restaurant => {
      restaurant = _restaurant;
      if (!_restaurant) return reject('Empty restaurant data');
      // fillRestaurantHTML();
      return resolve(_restaurant);
    }).catch(err => {
      reject(err);
    });
  });
};

/**
 * Create restaurant HTML and add it to the webpage
 */
var fillRestaurantHTML = (_restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = _restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = _restaurant.address;

  const picture = document.getElementById('restaurant-picture');
  const imgSrc = DBHelper.imageUrlForRestaurant(_restaurant);

  const source = document.createElement('source');
  source.sizes = '(max-width: 680px) 100vw, 50vw';
  // source.srcset = `${imgSrc.replace('.jpg', '-small.jpg')} 500w, ${imgSrc.replace('.jpg', '-medium.jpg')} 800w`;
  source.srcset = `${imgSrc}-small.webp 500w, ${imgSrc}-medium.webp 800w`;
  source.type = 'image/webp';

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  image.srcset = `${imgSrc}-medium.webp 800w`;
  image.src = `${imgSrc}-medium.jpg`;
  image.alt = `Cover photo for ${_restaurant.name}`;
  
  picture.insertBefore(source, image);
  
  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = _restaurant.cuisine_type;

  // fill operating hours
  if (_restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
var fillRestaurantHoursHTML = (operatingHours = restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
var fillReviewsHTML = (reviews) => {
  const container = document.getElementById('reviews-container');
  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  ul.innerHTML = '';
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
var createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.createdAt).toLocaleString();
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
var fillBreadcrumb = (rest = restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb-list');
  if (breadcrumb.children.length > 1) return;
  const li = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.href = '#';
  anchor.innerHTML = rest.name;
  anchor.setAttribute('aria-current', 'page');
  li.appendChild(anchor);
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
var getParameterByName = (name, url) => {
  if (!url) url = window.location.href;
  name = name.replace(/[[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};
