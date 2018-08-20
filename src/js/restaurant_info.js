const DBHelper = require('./dbhelper');
const loadGoogleMapsApi = require('load-google-maps-api');
let isDynamicMapLoaded = false;
let map, restaurant;
let _username = document.querySelector('#username');
let _rating = document.querySelector('#rating');
let _comments = document.querySelector('#comment');

const isFavoriteText = 'This restaurant is your favorite 💕';
const markAsFavoriteText = 'Mark this restaurant as your favorite 💕';
const gMapsOpts = {
  key: 'AIzaSyDX0ubSeymjp0TknoQccasOYsu7Aacu2f4',
  libraries: ['places']
};

let favoriteToggleButton, firstFocusElement, dialog, dismissDialogLink, reviewForm;

document.addEventListener('DOMContentLoaded', () => {

  firstFocusElement = document.activeElement;
  favoriteToggleButton = document.getElementById('toggle-favorite-button');
  reviewForm = document.getElementById('new-review-form');
  dialog = document.getElementById('network-off-dialog');
  dismissDialogLink = document.getElementById('network-off-dialog-dismiss');
  dismissDialogLink.tabIndex = -1;

  window.addEventListener('resize', onUserAction, { once: true });
  window.addEventListener('touchend', onUserAction, { once: true });
  document.getElementById('map').addEventListener('mouseover', onUserAction, { once: true });
  window.addEventListener('online', function() {
    console.log('Connected');
    favoriteToggleButton.disabled = false;
    dialog.classList.remove('active');
    dismissDialogLink.blur();
  });
  window.addEventListener('offline', function() {
    console.log('Disconnected');
    favoriteToggleButton.disabled = true;
    dialog.classList.add('active');
    dismissDialogLink.focus(); // set the focus to the dismiss link
    dismissDialogLink.tabIndex = 1;
  });
  reviewForm.addEventListener('submit', onReviewUpload);
  favoriteToggleButton.addEventListener('click', onFavoriteToggle);
  favoriteToggleButton.addEventListener('keypress', onFavoriteToggle);
  dismissDialogLink.addEventListener('click', networkDialogDismiss);
  dismissDialogLink.addEventListener('keypress', networkDialogDismiss);

  const isConnectedToNetwork = navigator.onLine;
  console.debug('Is connected to network =>', isConnectedToNetwork);
  if (!isConnectedToNetwork) {
    console.debug('Display alert for the user');
    dialog.classList.add('active');
    dismissDialogLink.focus(); // set the focus to the dismiss link
    dismissDialogLink.tabIndex = 1;
    favoriteToggleButton.disabled = true;
  }

  fetchRestaurantFromURL().then(_restaurant => {
    const whenPendingReviewsRead = DBHelper.readRestaurantPendingReviews(_restaurant.id);

    restaurant = _restaurant;

    fillBreadcrumb(_restaurant);
    fillRestaurantHTML(_restaurant);

    if (window.matchMedia('(max-width:580px)').matches) {
      loadStaticMapImage(_restaurant);
    } else {
      loadDynamicMap(gMapsOpts, _restaurant).then(map => {
        DBHelper.mapMarkerForRestaurant(_restaurant, map);
      });
    }

    // try to sync all the reviews
    console.debug('Trying to sync pending data...');
    whenPendingReviewsRead.then(_pendingReviews => {
      // try to send the updates
      return syncRestaurantData(_pendingReviews);
    }).then(() => {
      DBHelper.fetchRestaurantReviews(_restaurant.id).then(reviews => {
        _restaurant.reviews = reviews;
        fillReviewsHTML(reviews);
      }).catch(function(err) {
        console.error(err);
      });
    });
  }).catch(console.error);

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
    name,
    rating,
    comments
  };
  const isReviewValid = getIsReviewValid(review);
  if (!isReviewValid) {
    return;
  }
  console.debug(_username, _rating, comments);
  DBHelper.createRestaurantReview(restaurant.id, review).then(_review => {
    console.debug('Review created');
    document.getElementById('review-success-container').innerHTML = `
      <p class="review-success-message">Review created successfully!</p>
    `;
    reviewForm.reset();
    setTimeout(()=> {
      document.getElementById('review-success-container').innerHTML = '';
    }, 3000);
    // Add the review to the list
    let newReview = Object.assign(review, _review);
    restaurant.reviews.push(newReview);
    fillReviewsHTML(restaurant.reviews);
    if (!navigator.onLine) {
      dialog.classList.add('active');
    }
  }).catch(err => {
    console.error(err);
  });
};

const onFavoriteToggle = () => {
  const isFavorite = String(restaurant.is_favorite) == 'true';
  DBHelper.updateFavoriteRestaurant(restaurant.id, !isFavorite).then(() => {
    if (isFavorite) {
      // Unmark favorite
      favoriteToggleButton.classList.remove('active');
      favoriteToggleButton.innerText = markAsFavoriteText;
    } else {
      // mark favorite
      favoriteToggleButton.classList.add('active');
      favoriteToggleButton.innerText = isFavoriteText;
    }
    restaurant.is_favorite = !isFavorite;
    favoriteToggleButton.blur();
  }).catch(err => {
    console.error(err);
  });
};

const syncRestaurantData = (_pendingReviews) => {
  const whenPendingUpdates = _pendingReviews.map(_pendingReview => {
    return DBHelper.createRestaurantReview(_pendingReview.restaurant_id, _pendingReview);
  });
  return Promise.all(whenPendingUpdates).catch(err => {
    console.error(err);
    return Promise.resolve(); // continue the initialization
  });
};

const networkDialogDismiss = () => {
  dialog.classList.remove('active');
  dismissDialogLink.tabIndex = -1;
  console.log(document.activeElement, firstFocusElement);
  dismissDialogLink.blur();
  console.log(document.activeElement, firstFocusElement);
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
  }).catch(function(err) {
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

  if (String(_restaurant.is_favorite) == 'true'){
    favoriteToggleButton.classList.add('active');
    favoriteToggleButton.innerText = isFavoriteText;
  } else {
    favoriteToggleButton.innerText = markAsFavoriteText;
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
  reviews.sort((rev1, rev2) => {
    return rev1.createdAt - rev2.createdAt;
  }).forEach(review => {
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
  name.classList = 'username';
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.createdAt).toLocaleString();
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.classList = 'rating';
  let stars = '';
  for (let i = 0; i < review.rating; i++) {
    stars += '<span class="star">★</span>';
  }
  rating.innerHTML = `${stars}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.classList = 'comment';
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

var getIsReviewValid = (review) => {
  return review.name && review.comments && review.rating;
};
