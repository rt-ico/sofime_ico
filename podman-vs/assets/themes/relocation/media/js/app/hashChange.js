define(
	[],
	function () {
		"use strict";

		var useBrowserEvent = ('onhashchange' in window);
		var usePolling = !useBrowserEvent || !(window.addEventListener || window.attachEvent);

		var listeners = [];
		var oldHref = location.href;

		var $hashChange = {
			addHashChange: function (fn, before) {
				if (typeof fn === 'function') {
					if (useBrowserEvent && window.addEventListener) {
						window.addEventListener('hashchange', fn, before);
					}
					else if (useBrowserEvent && window.attachEvent) {
						window.attachEvent('onhashchange', fn);
					}
					else {
						listeners[before ? 'unshift' : 'push'](fn);
					}
				}
			},
			removeHashChange: function (fn) {
				for (var i = listeners.length - 1; i >= 0; i--) {
					if (useBrowserEvent && window.removeEventListener) {
						window.removeEventListener('hashchange', fn);
					}
					else if (useBrowserEvent && window.detachEvent) {
						window.detachEvent('onhashchange', fn);
					}
					else {
						if (listeners[i] === fn) {
							listeners.splice(i, 1);
						}
					}
				}
			}
		};

		if (usePolling) {
			setInterval(function () {
				var newHref = location.href;
				if (oldHref !== newHref) {
					var _oldHref = oldHref;
					oldHref = newHref;
					for (var i = 0; i < listeners.length; i++) {
						// IE browser events don't define "newURL" and "oldURL" properties
						listeners[i].call(window, {
							'type': 'hashchange',
							'newURL': newHref,
							'oldURL': _oldHref
						});
					}
				}
			}, 100);
		}

		return $hashChange;
	}
);