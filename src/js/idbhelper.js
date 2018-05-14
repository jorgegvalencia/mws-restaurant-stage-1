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
        // with 'keyPath' property we indicate which property of the object has to be treated as the unique key
        // creates the index 'animal' over the object store 
        restaurantsStore.createIndex('id', 'id'); 
        restaurantsStore.createIndex('cuisine', 'cuisine_type');
        restaurantsStore.createIndex('neighborhood', 'neighborhood');
      }
    }
  }

  storeRestaurants(restaurants) {
    return this._dbPromise.then(function(db) {
      if (!db) return;
      var tx = db.transaction('restaurants', 'readwrite'); // note here we have to specify the access type 'readwrite'
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
        console.log('From local db:', restaurant);
        return restaurant || this.getStoredRestaurants()
          .then(function(restaurants) {
            return restaurants.find(restaurant => restaurant.id === id);
          });
      });
  }

}

module.exports = new IDBHelper();


/*  
  dbPromise.then(function(db) {
    var tx = db.transaction('people');
    var peopleStore = tx.objectStore('people');
    var animalIndex = peopleStore.index('animal');
    return animalIndex.getAll('cat'); // here we query the objects from the store that have a cat
  }).then(function(people) {
    console.log('Cat people:', people);
  });

  dbPromise.then(function(db) {
    var tx = db.transaction('people');
    var peopleStore = tx.objectStore('people');
    var ageIndex = peopleStore.index('age');
    return ageIndex.openCursor(); // here we open a cursor
  }).then(function(cursor) {
    if (!cursor) return;
    return cursor.advance(2); // if we want to skip entries
  }).then(function logPerson(cursor) {
    if (!cursor) return;
    console.log('Cursored at:', cursor.value.name);
    // I could also do things like:
    // cursor.update(newValue) to change the value, or
    // cursor.delete() to delete this entry
    return cursor.continue().then(logPerson); // recursive iteration
  }).then(function() {
    console.log('Done cursoring');
  }); 
*/
