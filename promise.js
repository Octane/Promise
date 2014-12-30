/**
 * Promise polyfill v1.0.9
 * requires setImmediate
 *
 * © 2014–2015 Dmitry Korobkin
 * Released under the MIT license
 * github.com/Octane/Promise
 */
(function (global, TypeError) {'use strict';

    var STATUS = '[[PromiseStatus]]';
    var VALUE = '[[PromiseValue]]';
    var ON_FUlFILLED = '[[OnFulfilled]]';
    var ON_REJECTED = '[[OnRejected]]';
    var ORIGINAL_ERROR = '[[OriginalError]]';
    var PENDING = 'pending';
    var INTERNAL_PENDING = 'internal ' + PENDING;
    var FULFILLED = 'fulfilled';
    var REJECTED = 'rejected';
    var NOT_ARRAY = 'not an array.';
    var CHAINING_CYCLE = 'then() cannot return same Promise that it resolves.';
    var setImmediate = global.setImmediate || require('timers').setImmediate;

    function InternalError(originalError) {
        this[ORIGINAL_ERROR] = originalError;
    }

    function toPromise(anything, synchronously) {
        var then;
        if (isPromise(anything)) {
            return anything;
        }
        if(isObject(anything)) {
            try {
                then = anything.then;
            } catch (error) {
                return new InternalError(error);
            }
            if (isCallable(then)) {
                return new Promise(function (resolve, reject) {
                    if (synchronously) {
                        then.call(anything, resolve, reject);
                    } else {
                        setImmediate(function () {
                            try {
                                then.call(anything, resolve, reject);
                            } catch (error) {
                                reject(error);
                            }
                        });
                    }
                });
            }
        }
        return null;
    }

    function isObject(anything) {
        //Object.create(null) instanceof Object → false
        return Object(anything) === anything;
    }

    function isArray(anything) {
        return '[object Array]' == Object.prototype.toString.call(anything);
    }

    function isCallable(anything) {
        return 'function' == typeof anything;
    }

    function isPromise(anything) {
        return anything instanceof Promise;
    }

    function isInternalError(anything) {
        return anything instanceof InternalError;
    }

    function identity(value) {
        return value;
    }

    function thrower(reason) {
        throw reason;
    }

    function call(callback) {
        callback();
    }

    function Promise(resolver) {
        var promise = this;
        promise[STATUS] = PENDING;
        promise[VALUE] = undefined;
        promise[ON_FUlFILLED] = [];
        promise[ON_REJECTED] = [];
        resolvePromise(promise, resolver);
    }

    function resolvePromise(promise, resolver) {
        function resolve(value) {
            if (promise[STATUS] == PENDING) {
                fulfillPromise(promise, value);
            }
        }
        function reject(reason) {
            if (promise[STATUS] == PENDING) {
                rejectPromise(promise, reason);
            }
        }
        try {
            resolver(resolve, reject);
        } catch(error) {
            reject(error);
        }
    }

    function fulfillPromise(promise, value) {
        var anything = toPromise(value, true);
        if (isPromise(anything)) {
            promise[STATUS] = INTERNAL_PENDING;
            anything.then(
                function (value) {
                    fulfillPromise(promise, value);
                },
                function (reason) {
                    rejectPromise(promise, reason);
                }
            );
        } else if (isInternalError(anything)) {
            rejectPromise(promise, anything[ORIGINAL_ERROR]);
        } else {
            promise[STATUS] = FULFILLED;
            promise[VALUE] = value;
            promise[ON_FUlFILLED].forEach(call);
            clearQueue(promise);
        }
    }

    function rejectPromise(promise, reason) {
        promise[STATUS] = REJECTED;
        promise[VALUE] = reason;
        promise[ON_REJECTED].forEach(call);
        clearQueue(promise);
    }

    function enqueue(promise, onFulfilled, onRejected) {
        promise[ON_FUlFILLED].push(onFulfilled);
        promise[ON_REJECTED].push(onRejected);
    }

    function clearQueue(promise) {
        delete promise[ON_FUlFILLED];
        delete promise[ON_REJECTED];
    }

    function performPromiseThen(promise, onFulfilled, onRejected) {
        var nextPromise;
        onFulfilled = isCallable(onFulfilled) ? onFulfilled : identity;
        onRejected = isCallable(onRejected) ? onRejected : thrower;
        nextPromise = new Promise(function (resolve, reject) {
            function asyncOnFulfilled() {
                setImmediate(function () {
                    var anything;
                    var value;
                    try {
                        value = onFulfilled(promise[VALUE]);
                        if (nextPromise === value) {
                            throw new TypeError(CHAINING_CYCLE);
                        }
                    } catch (error) {
                        reject(error);
                        return;
                    }
                    anything = toPromise(value);
                    if (isPromise(anything)) {
                        anything.then(resolve, reject);
                    } else if (isInternalError(anything)) {
                        reject(anything[ORIGINAL_ERROR]);
                    } else {
                        resolve(value);
                    }
                });
            }
            function asyncOnRejected() {
                setImmediate(function () {
                    var anything;
                    var reason;
                    try {
                        reason = onRejected(promise[VALUE]);
                        if (nextPromise === reason) {
                            throw new TypeError(CHAINING_CYCLE);
                        }
                    } catch (error) {
                        reject(error);
                        return;
                    }
                    anything = toPromise(reason);
                    if (isPromise(anything)) {
                        anything.then(resolve, reject);
                    } else if (isInternalError(anything)) {
                        reject(anything[ORIGINAL_ERROR]);
                    } else {
                        resolve(reason);
                    }
                });
            }
            switch (promise[STATUS]) {
                case FULFILLED:
                    asyncOnFulfilled();
                    break;
                case REJECTED:
                    asyncOnRejected();
                    break;
                default:
                    enqueue(promise, asyncOnFulfilled, asyncOnRejected);
            }
        });
        return nextPromise;
    }

    Promise.prototype.then = function (onFulfilled, onRejected) {
        return performPromiseThen(this, onFulfilled, onRejected);
    };

    Promise.prototype['catch'] =  function (onRejected) {
        return performPromiseThen(this, identity, onRejected);
    };

    Promise.resolve = function (value) {
        var anything = toPromise(value);
        if (isPromise(anything)) {
            return anything;
        }
        return new Promise(function (resolve, reject) {
            if (isInternalError(anything)) {
                reject(anything[ORIGINAL_ERROR]);
            } else {
                resolve(value);
            }
        });
    };

    Promise.reject = function (reason) {
        return new Promise(function (resolve, reject) {
            reject(reason);
        });
    };

    Promise.race = function (values) {
        return new Promise(function (resolve, reject) {
            var anything;
            var length;
            var value;
            var i;
            if (isArray(values)) {
                length = values.length;
                for (i = 0; i < length; i++) {
                    value = values[i];
                    anything = toPromise(value);
                    if (isPromise(anything)) {
                        anything.then(resolve, reject);
                    } else if (isInternalError(anything)) {
                        reject(anything[ORIGINAL_ERROR]);
                    } else {
                        resolve(value);
                    }
                }
            } else {
                reject(new TypeError(NOT_ARRAY));
            }
        });
    };

    Promise.all = function (values) {
        return new Promise(function (resolve, reject) {
            var fulfilledCount = 0;
            var promiseCount = 0;
            var anything;
            var length;
            var value;
            var i;
            if (isArray(values)) {
                values = values.slice(0);
                length = values.length;
                for (i = 0; i < length; i++) {
                    value = values[i];
                    anything = toPromise(value);
                    if (isPromise(anything)) {
                        promiseCount++;
                        anything.then(
                            function (index) {
                                return function (value) {
                                    values[index] = value;
                                    fulfilledCount++;
                                    if (fulfilledCount == promiseCount) {
                                        resolve(values);
                                    }
                                };
                            }(i),
                            reject
                        );
                    } else if (isInternalError(anything)) {
                        reject(anything[ORIGINAL_ERROR]);
                    } else {
                        //[1, , 3] → [1, undefined, 3]
                        values[i] = value;
                    }
                }
                if (!promiseCount) {
                    resolve(values);
                }
            } else {
                reject(new TypeError(NOT_ARRAY));
            }
        });
    };

    if ('undefined' != typeof module && module.exports) {
        module.exports = global.Promise || Promise;
    } else if (!global.Promise) {
        global.Promise = Promise;
    }

}(this, TypeError));
