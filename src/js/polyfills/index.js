const loadScripts = require('../utils/loadscripts');

const polyfills = [];
if (!('Promise' in self)) polyfills.push('js/polyfills/promise.js');

try {
  new URL('b', 'http://a');
} catch (e) {
  polyfills.push('/js/polyfills/url.js');
}

loadScripts(polyfills, function() {});
