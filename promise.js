/**
 * Promise polyfill v1.0.8
 * requires setImmediate
 *
 * © 2014 Dmitry Korobkin
 * Released under the MIT license
 * github.com/Octane/Promise
 */
(function (global) {'use strict';

    var setImmediate = global.setImmediate || require('timers').setImmediate;

    function toPromise(thenable) {
        if (isPromise(thenable)) {
            return thenable;
        }
        return new Promise(function (resolve, reject) {
            setImmediate(function () {
                try {
                    thenable.then(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    function isCallable(anything) {
        return 'function' == typeof anything;
    }

    function isPromise(anything) {
        return anything instanceof Promise;
    }

    function isThenable(anything) {
        return Object(anything) === anything && isCallable(anything.then);
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

    function dive(thenable, onFulfilled, onRejected) {
        function interimOnFulfilled(value) {
            if (isThenable(value)) {
                toPromise(value).then(interimOnFulfilled, interimOnRejected);
            } else {
                onFulfilled(value);
            }
        }
        function interimOnRejected(reason) {
            if (isThenable(reason)) {
                toPromise(reason).then(interimOnFulfilled, interimOnRejected);
            } else {
                onRejected(reason);
            }
        }
        toPromise(thenable).then(interimOnFulfilled, interimOnRejected);
    }

    function Promise(resolver) {
        this._fulfilled = false;
        this._rejected = false;
        this._value = undefined;
        this._reason = undefined;
        this._onFulfilled = [];
        this._onRejected = [];
        this._resolve(resolver);
    }

    Promise.resolve = function (value) {
        if (isThenable(value)) {
            return toPromise(value);
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
            var value,
                length = values.length,
                i = 0;
            while (i < length) {
                value = values[i];
                if (isThenable(value)) {
                    dive(value, resolve, reject);
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
                value,
                length = values.length,
                i = 0;
            values = values.slice(0);
            while (i < length) {
                value = values[i];
                if (isThenable(value)) {
                    thenables++;
                    dive(
                        value,
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
            var promise = this;
            if (!isSettled(promise)) {
                if (isThenable(value)) {
                    toPromise(value).then(
                        function (value) {
                            promise._fulfill(value);
                        },
                        function (reason) {
                            promise._reject(reason);
                        }
                    );
                } else {
                    promise._fulfilled = true;
                    promise._value = value;
                    promise._onFulfilled.forEach(call);
                    promise._clearQueue();
                }
            }
        },

        _reject: function (reason) {
            if (!isSettled(this)) {
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

            var promise = this;

            onFulfilled = isCallable(onFulfilled) ? onFulfilled : identity;
            onRejected = isCallable(onRejected) ? onRejected : thrower;

            return new Promise(function (resolve, reject) {

                function asyncOnFulfilled() {
                    setImmediate(function () {
                        var value;
                        try {
                            value = onFulfilled(promise._value);
                        } catch (error) {
                            reject(error);
                            return;
                        }
                        if (isThenable(value)) {
                            toPromise(value).then(resolve, reject);
                        } else {
                            resolve(value);
                        }
                    });
                }

                function asyncOnRejected() {
                    setImmediate(function () {
                        var reason;
                        try {
                            reason = onRejected(promise._reason);
                        } catch (error) {
                            reject(error);
                            return;
                        }
                        if (isThenable(reason)) {
                            toPromise(reason).then(resolve, reject);
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
