const idb = require('idb');

class IDBHelper {
  constructor() {
    if (!navigator.serviceWorker) {
      this._dbPromise = Promise.resolve();
      return;
    }
    /*eslint no-fallthrough: 0 */
    this._dbPromise = idb.open('mws-restaurant-reviews', 1, noPrevDBOrHigherVersion);
    // only called if 
    // (1) the db doesn't exists yet 
    // (2) the version number of the current db is lesser than the version number set in the open call
    function noPrevDBOrHigherVersion(upgradeDb) { // upgrade callback
      switch (upgradeDb.oldVersion) {
      case 0:
        var restaurantsStore = upgradeDb.createObjectStore('restaurants', {
          keyPath: 'id'
        });
        restaurantsStore.createIndex('id', 'id');
        restaurantsStore.createIndex('cuisine', 'cuisine_type');
        restaurantsStore.createIndex('neighborhood', 'neighborhood');
        var reviewsStore = upgradeDb.createObjectStore('reviews', {
          keyPath: '_pendingUpdateId'
        });
        reviewsStore.createIndex('id', 'id');
        reviewsStore.createIndex('restaurant_id', 'restaurant_id');
        reviewsStore.createIndex('pending_id', '_pendingUpdateId');
      }
    }
  }

  writeRestaurants(restaurants) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants', 'readwrite');
      var restaurantsStore = tx.objectStore('restaurants');
      restaurants.forEach(restaurant => {
        restaurantsStore.put(restaurant);
      });
      return tx.complete;
    });
  }

  readStoredRestaurants() {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants');
      var restaurantsStore = tx.objectStore('restaurants');
      var idIndex = restaurantsStore.index('id');
      return idIndex.getAll();
    });
  }

  readStoredRestaurant(id) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants');
      var restaurantsStore = tx.objectStore('restaurants');
      var idIndex = restaurantsStore.index('id');
      return idIndex.get(+id);
    }).then((restaurant) => {
      return restaurant || this.readStoredRestaurants()
        .then(function(restaurants) {
          return restaurants.find(restaurant => restaurant.id === id);
        });
    });
  }

  updateRestaurant(restaurant) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants', 'readwrite');
      var restaurantsStore = tx.objectStore('restaurants');
      restaurantsStore.put(restaurant);
      return tx.complete;
    });
  }

  // store a list of reviews
  // a) id de review <- devuelto cuando se ha creado/actualizado la review
  // b) (con actualizaciones) utlizariamos un flag
  writeReviews(reviews) {
    return this._dbPromise.then(db => {
      if (!db) return;
      const tx = db.transaction('reviews', 'readwrite');
      const reviewsStore = tx.objectStore('reviews');
      reviews.forEach(review => {
        if (!review._pendingUpdateId) review._pendingUpdateId = review.id;
        review.restaurant_id = review.restaurant_id && +review.restaurant_id;
        reviewsStore.put(review);
      });
      return tx.complete;
    });
  }

  writeUpdatePendingReview(pendingUpdateId, review) {
    return this._dbPromise.then(db => {
      if (!db) return;
      const tx = db.transaction('reviews', 'readwrite');
      const reviewsStore = tx.objectStore('reviews');
      review.restaurant_id = review.restaurant_id && +review.restaurant_id;
      reviewsStore.delete(+pendingUpdateId);
      reviewsStore.put(review);
      return tx.complete;
    });
  }

  readStoredPendingReview(_pendingUpdateId) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('reviews');
      var reviewsStore = tx.objectStore('reviews');
      var idIndex = reviewsStore.index('pending_id');
      return idIndex.get(+_pendingUpdateId);
    });
  }

  // get reviews for a specific restaurant
  readStoredReviews(restaurantId) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('reviews');
      var reviewsStore = tx.objectStore('reviews');
      var idIndex = reviewsStore.index('restaurant_id');
      return idIndex.getAll(+restaurantId);
    });
  }

  readRestaurantPendingReviews(restaurantId) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('reviews');
      var reviewsStore = tx.objectStore('reviews');
      var idIndex = reviewsStore.index('id');
      return idIndex.getAll('').then(reviews => {
        if (!reviews) return Promise.resolve([]);
        const pendingReviews = reviews.filter(_review => {
          return _review.restaurant_id == restaurantId;
        });
        return Promise.resolve(pendingReviews);
      });
    });
  }

  readAllPendingReviews() {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('reviews');
      var reviewsStore = tx.objectStore('reviews');
      var idIndex = reviewsStore.index('id');
      return idIndex.getAll('');
    });
  }

}

module.exports = new IDBHelper();
