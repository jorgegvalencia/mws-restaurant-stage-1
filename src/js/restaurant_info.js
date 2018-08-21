const DBHelper = require('./dbhelper');
const loadGoogleMapsApi = require('load-google-maps-api');
let isDynamicMapLoaded = false;
let map, currentRestaurant;
let _username = document.querySelector('#username');
let _rating = document.querySelector('#rating');
let _comments = document.querySelector('#comment');

const isFavoriteText = 'This restaurant is your favorite 💕';
const markAsFavoriteText = 'Mark this restaurant as your favorite 💕';
const gMapsOpts = {
  key: 'AIzaSyDX0ubSeymjp0TknoQccasOYsu7Aacu2f4',
  libraries: ['places']
};

let favoriteToggleButton, previousFocusedElement, dialog,
  dismissDialogLink, reviewForm, reviewSuccessMessageContainer;

// ===================================== Life cycle =====================================
document.addEventListener('DOMContentLoaded', activate);

function activate() {
  // Initialize DOM element references
  previousFocusedElement = document.activeElement;
  favoriteToggleButton = document.getElementById('toggle-favorite-button');
  reviewForm = document.getElementById('new-review-form');
  dialog = document.getElementById('network-off-dialog');
  dismissDialogLink = document.getElementById('network-off-dialog-dismiss');
  reviewSuccessMessageContainer = document.getElementById('review-success-container');

  // Setup event listeners handlers
  document.getElementById('map').addEventListener('mouseover', onUserAction, { once: true });
  window.addEventListener('resize', onUserAction, { once: true });
  window.addEventListener('touchend', onUserAction, { once: true });
  window.addEventListener('online', onOnlineNetwork, { once: true });
  window.addEventListener('offline', onOfflineNetwork);

  reviewForm.addEventListener('submit', onReviewUpload);
  favoriteToggleButton.addEventListener('click', onFavoriteToggle);
  favoriteToggleButton.addEventListener('keypress', onFavoriteToggle);
  dismissDialogLink.addEventListener('click', onNetworkDialogDismiss);
  dismissDialogLink.addEventListener('keypress', onNetworkDialogDismiss);

  if (!navigator.onLine) {
    console.debug('Not connected to the network');
    console.debug('Display alert dialog for the user');
    openOfflineNetworkDialog();
    favoriteToggleButton.disabled = true;
  }

  fetchRestaurantFromURL().then(_restaurant => {
    const whenPendingReviewsRead = DBHelper.readRestaurantPendingReviews(_restaurant.id);
    currentRestaurant = _restaurant; // track the state of the current restaurant

    // Render logic
    fillBreadcrumb(currentRestaurant);
    fillRestaurantHTML(currentRestaurant);
    loadRestaurantLocationMap(currentRestaurant);

    // Try to sync all the reviews
    console.debug('Trying to sync pending data...');
    return whenPendingReviewsRead.then(_pendingReviews => {
      return syncRestaurantData(_pendingReviews); // Send new pending reviews
    }).then(() => { // Fetch last reviews data from server
      return DBHelper.fetchRestaurantReviews(currentRestaurant.id);
    }).then(_reviews => {
      currentRestaurant.reviews = _reviews;
      fillReviewsHTML(_reviews);
    });
  }).catch(console.error);
}

// ===================================== Event handlers =====================================
const onUserAction = () => {
  if (!isDynamicMapLoaded) loadDynamicMap(gMapsOpts, currentRestaurant);
};

const onReviewUpload = (e) => {
  e.preventDefault();
  const name = _username.value;
  const rating = _rating.value;
  const comments = _comments.value;
  const review = { name, rating, comments };
  const isReviewValid = getIsReviewValid(review);
  if (!isReviewValid) return;

  console.debug(_username, _rating, comments);
  DBHelper.createRestaurantReview(currentRestaurant.id, review).then(_review => {
    console.debug('Review created');
    // Add the review to the list
    const newReview = Object.assign(review, _review);
    currentRestaurant.reviews.push(newReview);
    fillReviewsHTML(currentRestaurant.reviews);

    // Show a success message
    reviewSuccessMessageContainer.innerHTML = `
      <p class="review-success-message">Review created successfully!</p>`;
    reviewForm.reset();
    setTimeout(()=> {
      reviewSuccessMessageContainer.innerHTML = '';
    }, 3000);

    if (!navigator.onLine) {
      openOfflineNetworkDialog();
    }
  }).catch(err => {
    console.error(err);
  });
};

const onFavoriteToggle = () => {
  const isFavorite = String(currentRestaurant.is_favorite) == 'true';
  DBHelper.updateFavoriteRestaurant(currentRestaurant.id, !isFavorite).then(() => {
    toggleFavorite(isFavorite);
    currentRestaurant.is_favorite = !isFavorite;
    favoriteToggleButton.blur();
  }).catch(err => {
    console.error(err);
  });
};

const onOnlineNetwork = () => {
  console.log('Connected');
  favoriteToggleButton.disabled = false;

  dialog.classList.remove('active');
  dismissDialogLink.blur();

  // sync db
  DBHelper.readRestaurantPendingReviews(currentRestaurant.id).then(_pendingReviews => {
    return syncRestaurantData(_pendingReviews).then(() => {
      DBHelper.fetchRestaurantReviews(currentRestaurant.id).then(reviews => {
        currentRestaurant.reviews = reviews;
        fillReviewsHTML(reviews);
      });
    });
  }).catch(function(err) {
    console.error(err);
  });
  loadRestaurantLocationMap(currentRestaurant);
};

const onOfflineNetwork = () => {
  console.log('Disconnected');
  favoriteToggleButton.disabled = true;
  openOfflineNetworkDialog();
};

const onNetworkDialogDismiss = () => {
  closeOfflineNetworkDialog();
};

// ===================================== Helper methods =====================================
const syncRestaurantData = (_pendingReviews) => {
  const whenPendingUpdates = _pendingReviews.map(_pendingReview => {
    return DBHelper.createRestaurantReview(_pendingReview.restaurant_id, _pendingReview);
  });
  return Promise.all(whenPendingUpdates).catch(err => {
    console.error(err);
    return Promise.resolve(); // continue the initialization
  });
};

const openOfflineNetworkDialog = () => {
  previousFocusedElement = document.activeElement;
  dialog.classList.add('active');
  dialog.setAttribute('aria-hidden', false);
  dismissDialogLink.focus(); // set the focus to the dismiss link
  dismissDialogLink.tabIndex = 1;
};

const closeOfflineNetworkDialog = () => {
  dialog.classList.remove('active');
  dialog.setAttribute('aria-hidden', true);
  dismissDialogLink.tabIndex = -1;
  dismissDialogLink.blur();
  previousFocusedElement.focus();
};

const toggleFavorite = (isFavorite) => {
  if (isFavorite) {
    // Unmark favorite
    favoriteToggleButton.classList.remove('active');
    favoriteToggleButton.setAttribute('aria-pressed', false);
    favoriteToggleButton.innerText = markAsFavoriteText;
  } else {
    // mark favorite
    favoriteToggleButton.classList.add('active');
    favoriteToggleButton.setAttribute('aria-pressed', true);
    favoriteToggleButton.innerText = isFavoriteText;
  }
};

const loadRestaurantLocationMap = (_restaurant) => {
  if (window.matchMedia('(max-width:580px)').matches) {
    loadStaticMapImage(_restaurant);
  } else {
    loadDynamicMap(gMapsOpts, _restaurant).then(map => {
      DBHelper.mapMarkerForRestaurant(_restaurant, map);
    });
  }
};

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

const fetchRestaurantFromURL = () => {
  return new Promise((resolve, reject) => {
    const id = getParameterByName('id');
    if (!id) { // no id found in URL
      return reject('No restaurant id in URL');
    }
    DBHelper.fetchRestaurantById(id).then(_restaurant => {
      if (!_restaurant) return reject('Empty restaurant data');
      return resolve(_restaurant);
    }).catch(err => {
      reject(err);
    });
  });
};

const fillRestaurantHTML = (_restaurant) => {
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
    fillRestaurantHoursHTML(_restaurant.operating_hours);
  }

  const isFavorite = String(_restaurant.is_favorite) == 'true';
  toggleFavorite(isFavorite);
};

const fillRestaurantHoursHTML = (operatingHours) => {
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

const fillReviewsHTML = (reviews) => {
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

const createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.classList = 'username';
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  const dateOpts = {
    hour12: false,
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  };
  date.innerHTML = `Posted on ${new Date(review.createdAt).toLocaleString('en-EN', dateOpts)}`;
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

const fillBreadcrumb = (_restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb-list');
  if (breadcrumb.children.length > 1) return;
  const li = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.href = '#';
  anchor.innerHTML = _restaurant.name;
  anchor.setAttribute('aria-current', 'page');
  li.appendChild(anchor);
  breadcrumb.appendChild(li);
};

const getParameterByName = (name, url) => {
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

const getIsReviewValid = (review) => {
  return review.name && review.comments && review.rating;
};

