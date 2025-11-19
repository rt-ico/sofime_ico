define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (/*path, oldPath, sameRoute, fnHasPathChanged*/) {
				if (!home.User.expat) {
					throw new Error("forbidden");
				}
				home.Router.go(["visits",home.User.id]);
			}
		};
	}
);