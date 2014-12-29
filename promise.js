/**
 * Promise polyfill v1.0.9
 * requires setImmediate
 *
 * © 2014 Dmitry Korobkin
 * Released under the MIT license
 * github.com/Octane/Promise
 */
(function (global) {'use strict';

    var setImmediate = global.setImmediate || require('timers').setImmediate,
        CHAINING_CYCLE = 'then() cannot return same Promise that it resolves.';

    function InternalError(originalError) {
        this.originalError = originalError;
    }

    function toPromise(anything, synchronous) {
        var then;
        if (isPromise(anything)) {
            return anything;
        }
        if(Object(anything) === anything) {
            try {
                then = anything.then;
            } catch (error) {
                return new InternalError(error);
            }
            if (isCallable(then)) {
                return new Promise(function (resolve, reject) {
                    if (synchronous) {
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

    function isCallable(anything) {
        return 'function' == typeof anything;
    }

    function isPromise(anything) {
        return anything instanceof Promise;
    }

    function isInternalError(anything) {
        return anything instanceof InternalError;
    }

    function isSettled(promise) {
        return promise._fulfilled || promise._rejected;
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

    function dive(promise, onFulfilled, onRejected) {
        function interimOnFulfilled(value) {
            var anything = toPromise(value);
            if (isPromise(anything)) {
                anything.then(interimOnFulfilled, interimOnRejected);
            } else if (isInternalError(anything)) {
                onRejected(anything.originalError);
            } else {
                onFulfilled(value);
            }
        }
        function interimOnRejected(reason) {
            var anything = toPromise(reason);
            if (isPromise(anything)) {
                anything.then(interimOnFulfilled, interimOnRejected);
            } else if (isInternalError(anything)) {
                onRejected(anything.originalError);
            } else {
                onRejected(reason);
            }
        }
        promise.then(interimOnFulfilled, interimOnRejected);
    }

    function Promise(resolver) {
        this._pending = false;
        this._fulfilled = false;
        this._rejected = false;
        this._value = undefined;
        this._reason = undefined;
        this._onFulfilled = [];
        this._onRejected = [];
        this._resolve(resolver);
    }

    Promise.resolve = function (value) {
        var anything = toPromise(value);
        if (isPromise(anything)) {
            return anything;
        }
        if (isInternalError(anything)) {
            return new Promise(function (resolve, reject) {
                reject(anything.originalError);
            });
        }
        return new Promise(function (resolve) {
            resolve(value);
        });
    };

    Promise.reject = function (reason) {
        return new Promise(function (resolve, reject) {
            reject(reason);
        });
    };

    Promise.race = function (values) {
        return new Promise(function (resolve, reject) {
            var anything,
                value,
                length = values.length,
                i = 0;
            while (i < length) {
                value = values[i];
                anything = toPromise(value);
                if (isPromise(anything)) {
                    dive(anything, resolve, reject);
                } else if (isInternalError(anything)) {
                    reject(anything.originalError);
                } else {
                    resolve(value);
                }
                i++;
            }
        });
    };

    Promise.all = function (values) {
        return new Promise(function (resolve, reject) {
            var thenables = 0,
                fulfilled = 0,
                anything,
                value,
                length = values.length,
                i = 0;
            values = values.slice(0);
            while (i < length) {
                value = values[i];
                anything = toPromise(value);
                if (isPromise(anything)) {
                    thenables++;
                    dive(
                        anything,
                        function (index) {
                            return function (value) {
                                values[index] = value;
                                fulfilled++;
                                if (fulfilled == thenables) {
                                    resolve(values);
                                }
                            };
                        }(i),
                        reject
                    );
                } else if (isInternalError(anything)) {
                    reject(anything.originalError);
                } else {
                    //[1, , 3] → [1, undefined, 3]
                    values[i] = value;
                }
                i++;
            }
            if (!thenables) {
                resolve(values);
            }
        });
    };

    Promise.prototype = {

        constructor: Promise,

        _resolve: function (resolver) {

            var promise = this;

            function resolve(value) {
                promise._fulfill(value);
            }

            function reject(reason) {
                promise._reject(reason);
            }

            try {
                resolver(resolve, reject);
            } catch(error) {
                if (!isSettled(promise)) {
                    reject(error);
                }
            }

        },

        _fulfill: function (value) {
            var promise = this,
                anything;
            if (!isSettled(promise) && !promise._pending) {
                anything = toPromise(value, true);
                if (isPromise(anything)) {
                    promise._pending = true;
                    anything.then(
                        function (value) {
                            promise._pending = false;
                            promise._fulfill(value);
                        },
                        function (reason) {
                            promise._pending = false;
                            promise._reject(reason);
                        }
                    );
                } else if (isInternalError(anything)) {
                    promise._reject(anything.originalError);
                } else {
                    promise._fulfilled = true;
                    promise._value = value;
                    promise._onFulfilled.forEach(call);
                    promise._clearQueue();
                }
            }
        },

        _reject: function (reason) {
            if (!isSettled(this) && !this._pending) {
                this._rejected = true;
                this._reason = reason;
                this._onRejected.forEach(call);
                this._clearQueue();
            }
        },

        _enqueue: function (onFulfilled, onRejected) {
            this._onFulfilled.push(onFulfilled);
            this._onRejected.push(onRejected);
        },

        _clearQueue: function () {
            this._onFulfilled = [];
            this._onRejected = [];
        },

        then: function (onFulfilled, onRejected) {

            var promise = this,
                nextPromise;

            onFulfilled = isCallable(onFulfilled) ? onFulfilled : identity;
            onRejected = isCallable(onRejected) ? onRejected : thrower;

            nextPromise = new Promise(function (resolve, reject) {

                function asyncOnFulfilled() {
                    setImmediate(function () {
                        var anything,
                            value;
                        try {
                            value = onFulfilled(promise._value);
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
                            reject(anything.originalError);
                        } else {
                            resolve(value);
                        }
                    });
                }

                function asyncOnRejected() {
                    setImmediate(function () {
                        var anything,
                            reason;
                        try {
                            reason = onRejected(promise._reason);
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
                            reject(anything.originalError);
                        } else {
                            resolve(reason);
                        }
                    });
                }

                if (promise._fulfilled) {
                    asyncOnFulfilled();
                } else if (promise._rejected) {
                    asyncOnRejected();
                } else {
                    promise._enqueue(asyncOnFulfilled, asyncOnRejected);
                }

            });

            return nextPromise;

        },

        'catch': function (onRejected) {
            return this.then(undefined, onRejected);
        }

    };

    if ('undefined' != typeof module && module.exports) {
        module.exports = global.Promise || Promise;
    } else if (!global.Promise) {
        global.Promise = Promise;
    }

}(this));
