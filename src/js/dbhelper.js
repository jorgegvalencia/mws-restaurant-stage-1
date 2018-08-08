/**
 * Common database helper functions.
 */

const IDBHelper = require('./idbhelper');
module.exports = class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get API_ENDPOINT() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants() {
    return fetch(DBHelper.API_ENDPOINT + '/restaurants')
      .then(response => response.json())
      .then(restaurants => {
        IDBHelper.storeRestaurants(restaurants);
        return Promise.resolve(restaurants);
      }).catch(() => {
        // try to get the restaurant data from the local db
        return IDBHelper.getStoredRestaurants().then(restaurants => {
          return Promise.resolve(restaurants);
        });
      }).catch(function(error) {
        return error;
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id) {
    return fetch(DBHelper.API_ENDPOINT + '/restaurants/' + id)
      .then(response => response.json())
      .then(restaurant => {
        return Promise.resolve(restaurant);
      })
      .catch(() => {
        return IDBHelper.getStoredRestaurant(id).then(restaurant => {
          if (restaurant) return Promise.resolve(restaurant);
          return Promise.reject('Empty restaurant');
        });
      }).catch(function(error) {
        return error;
      });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine) {
    // Fetch all restaurants with proper error handling
    return DBHelper.fetchRestaurants().then(restaurants => {
      // Filter restaurants to have only given cuisine type
      const results = restaurants.filter(r => r.cuisine_type == cuisine);
      return Promise.resolve(results);
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood) {
    // Fetch all restaurants with proper error handling
    return DBHelper.fetchRestaurants().then(restaurants => {
      // Filter restaurants to have only given cuisine type
      const results = restaurants.filter(r => r.neighborhood == neighborhood);
      return Promise.resolve(results);
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood) {
    // Fetch all restaurants
    return DBHelper.fetchRestaurants().then(restaurants => {
      let results = restaurants;
      if (cuisine != 'all') { // filter by cuisine
        results = results.filter(r => r.cuisine_type == cuisine);
      }
      if (neighborhood != 'all') { // filter by neighborhood
        results = results.filter(r => r.neighborhood == neighborhood);
      }
      return Promise.resolve(results);
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods() {
    // Fetch all restaurants
    return DBHelper.fetchRestaurants().then(restaurants => {
      // Get all neighborhoods from all restaurants
      const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
      // Remove duplicates from neighborhoods
      const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
      return Promise.resolve(uniqueNeighborhoods);
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines() {
    // Fetch all restaurants
    return DBHelper.fetchRestaurants().then(restaurants => {
      // Get all cuisines from all restaurants
      const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
      // Remove duplicates from cuisines
      const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
      return Promise.resolve(uniqueCuisines);
    });
  }

  static fetchReviews() {
    return fetch(DBHelper.API_ENDPOINT + '/reviews')
      .then(response => response.json())
      .then(reviews => {
        // IDBHelper.storeReviews(reviews);
        return Promise.resolve(reviews);
      }).catch(() => {
        // try to get the reviews data from the local db
        // return IDBHelper.getStoredReviews().then(reviews => {
        //   return Promise.resolve(reviews);
        // });
      }).catch(function(error) {
        return error;
      });
  }

  static fetchRestaurantReviews(restaurantId) {
    return fetch(DBHelper.API_ENDPOINT + `/reviews/?restaurant_id=${restaurantId}`)
      .then(response => response.json())
      .then(reviews => {
        // IDBHelper.storeReviews(reviews);
        return Promise.resolve(reviews);
      }).catch(() => {
        // try to get the reviews data from the local db
        // return IDBHelper.getStoredRestaurantReviews(restaurantId).then(reviews => {
        //   return Promise.resolve(reviews);
        // });
      }).catch(function(error) {
        return error;
      });
  }

  static createRestaurantReview(restaurantId, review) {
    const request = {
      method: 'POST',
      url: DBHelper.API_ENDPOINT + `/reviews/?restaurant_id=${restaurantId}`,
      data: review
    };
    return fetch(request)
      .then(response => response.json())
      .then(review => {
        // Response example
        // {
        //     "restaurant_id": "1",
        //     "name": "Test",
        //     "rating": "1",
        //     "comments": "Test review",
        //     "createdAt": "2018-08-08T18:34:06.466Z",
        //     "updatedAt": "2018-08-08T18:34:06.466Z",
        //     "id": 31
        // }
        // search if the review is pending
        // if found, set as sent (set the server id)
        // if not, store the new review (set the id as null)
        // IDBHelper.storeReview(review);
        return Promise.resolve(review);
      })
      .catch(() => {
        // store the review as pending
        // return IDBHelper.storePendingReview(restaurantId).then(review => {
        //   return Promise.resolve(review);
        // });
      })
      .catch(function(error) {
        return error;
      });
  }

  // static updateRestaurantReview(restaurantId, review) {
  //   const request = {
  //     method: 'PUT',
  //     url: DBHelper.API_ENDPOINT + `/reviews/${review.id}`,
  //     data: review
  //   };
  //   return fetch(request)
  //     .then(response => response.json())
  //     .then(review => {
  //       // Response example
  //       // {
  //       //     "restaurant_id": "1",
  //       //     "name": "Test",
  //       //     "rating": "1",
  //       //     "comments": "Test review",
  //       //     "createdAt": "2018-08-08T18:34:06.466Z",
  //       //     "updatedAt": "2018-08-08T18:34:06.466Z",
  //       //     "id": 31
  //       // }
  //       // search if the review is pending
  //       // if found, set as sent
  //       // if not, store the new review
  //       // IDBHelper.storeReview(reviews);
  //       return Promise.resolve(review);
  //     })
  //     .catch(() => {
  //       // store the review as pending
  //       // return IDBHelper.storePendingReview(restaurantId).then(review => {
  //       //   return Promise.resolve(review);
  //       // });
  //     })
  //     .catch(function(error) {
  //       return error;
  //     });
  // }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
    return marker;
  }

};
