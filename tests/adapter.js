var Promise = require('../promise.js');

module.exports = {

    deferred: function () {
        var deferred = {};
        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        return deferred;
    },

    resolved: function (value) {
        return Promise.resolve(value);
    },

    rejected: function (reason) {
        return Promise.reject(reason);
    }

};
