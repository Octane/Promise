# ES6 Promise polyfill [![Build Status](https://travis-ci.org/Octane/Promise.svg?branch=master)](https://travis-ci.org/Octane/Promise)

[![NPM](https://nodei.co/npm/es6-promises.png?downloads=true)](https://nodei.co/npm/es6-promises/)

To use the Promise polyfill, just drop two JavaScript files into your page:
```html
<script src="setimmediate.js"></script>
<script src="promise.js"></script>
```
or load as the Node.js module:
```javascript
var Promise = require('es6-promises');
```

Download the [latest Promise polyfill from GitHub](https://raw.githubusercontent.com/Octane/Promise/master/promise.js).

**npm**
```
npm install es6-promises
```
**Bower**
```
bower install promises
```

## Dependencies

The Promise polyfill requieres `setImmediate` ([msdn](http://msdn.microsoft.com/en-us/library/ie/hh773176), [nodejs](http://nodejs.org/api/timers.html#timers_setimmediate_callback_arg), [polyfill](https://github.com/Octane/setImmediate/)).

## Tests

<a href="https://github.com/promises-aplus/promises-tests"><img src="http://promises-aplus.github.com/promises-spec/assets/logo-small.png" alt="Promises/A+ logo" width="41" valign="middle"> Promises/A+ compliant</a>
```
git clone https://github.com/Octane/Promise.git
cd Promise
npm install
npm test
```

## License

The Promise polyfill is released under the [MIT license](https://github.com/Octane/Promise/blob/master/LICENSE).
