requirejs(
	['app/RT', 'jquery', 'lodash'],
	function (RT, $, _) {
		"use strict";

		var txt = RT.Text;
		var fmt = RT.Format;

		// initialize on load
		$(function () {
			var $form = $('form').eq(0);

			if ($form.length) {
				// input form mode
				var $email = $('#email');

				$form.on('submit', function () {
					var allow = true;

					if ($email.val().indexOf("@") < 0) {
						$email.select().focus();
						allow = false;
					}

					return allow;
				});

				setTimeout(function () {
					$email.select().focus();
				}, 20);
			}
			else {
				// result/message mode
			}
		});
	}
);