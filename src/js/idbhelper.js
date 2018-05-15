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
      }
    }
  }

  storeRestaurants(restaurants) {
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

  getStoredRestaurants() {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants');
      var restaurantsStore = tx.objectStore('restaurants');
      var idIndex = restaurantsStore.index('id');
      return idIndex.getAll();
    });
  }

  getStoredRestaurant(id) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants');
      var restaurantsStore = tx.objectStore('restaurants');
      var idIndex = restaurantsStore.index('id');
      return idIndex.get(+id);
    })
      .then((restaurant) => {
        return restaurant || this.getStoredRestaurants()
          .then(function(restaurants) {
            return restaurants.find(restaurant => restaurant.id === id);
          });
      });
  }

}

module.exports = new IDBHelper();
