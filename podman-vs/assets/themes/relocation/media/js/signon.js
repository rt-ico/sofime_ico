requirejs(
	['jquery'],
	function ($) {
		"use strict";

		if (!window.Promise) {
			if (location.search !== "?fail=ua") {
				location.replace("?fail=ua");
			}
			return;
		}

		var $form = $('form').eq(0);
		$form.on('submit', function () {
			var allow = true;

			$form.find('input[type=text]:first, input[type=password]:first').each(function () {
				if ("" === $(this).val()) {
					$(this).select().focus();
					allow = false;
					return false; // stop loop
				}
			});

			return allow;
		});
		var hashUri = location.hash;
		if (hashUri.length > 1) {
			$form.attr('action', $form.attr('action') + hashUri);
			$form.find('input[name=hashUri]').val(hashUri);
		}

		setTimeout(function () {
			$form.find('input[type=text]').select().focus();
		}, 20);
	}
);