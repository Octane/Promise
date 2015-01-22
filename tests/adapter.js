'use strict';

/** @see https://github.com/promises-aplus/promises-tests */
var Promise = require('../index.js');

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
