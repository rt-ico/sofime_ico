define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var txt = RT.Text;
		var fmt = RT.Format;


		return {
			init: function (context) {
				ctx = context;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				console.log("-> TODO: %s", path[0]); // TODO
				home.View.Pane.content.empty().append('<p><div class="card">' + _.escape(path[0]) + '</div></p>');
			}
		};
	}
);