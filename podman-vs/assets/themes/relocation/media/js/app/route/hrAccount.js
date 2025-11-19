define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.Profile.require("HR");
				home.View.actions = null;

				var tpl = {
					card: "hrAccount"
				};
				var images = {
					download: "ux-download.svg"
				};
				var model = {
					account: null,
					clients: null,
					rerouted: false
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.accountHR,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.account = rs.data.account;
							model.clients = rs.data.clients;
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					var $update = $card.find('.footer a.update').eq(0);

					var controls = {
						sn: $('#account-sn'),
						gn: $('#account-gn'),
						workMail: $('#account-workMail'),
						workTel: $('#account-workTel')
					};

					var mediate = function () {
						var canSubmit = !!(controls.sn.val() && controls.gn.val());

						if (canSubmit) {
							canSubmit = !!(controls.workTel.val());
						}
						if (canSubmit) {
							var mre = /^[^@]+@[^@]+$/;
							var validated = {};

							_.each(["workMail"], function (k) {
								validated[k] = false;
								var $f = controls[k];
								var v = $f.val();
								if (v) {
									if (mre.test(v)) {
										validated[k] = true;
									}
									else {
										$f.val("");
									}
								}
							});
							canSubmit = !!validated.workMail;
						}

						RT.jQuery.withClassIf($update, "disabled", !canSubmit);
					};

					(function () {
						var $txt = $card.find('input[type="text"]:not(.combo), input[type="email"], input[type="tel"]');
						RT.jQuery.selectOnFocus($txt);
						RT.jQuery.trimOnBlur($txt);

						controls.workMail.on('input change', function () {
							this.value = this.value.toLowerCase();
						});
						controls.workTel.on('input change', function () {
							var v1 = this.value;
							var v2 = v1.replace(/[^0-9.+() ]/g, "");
							if (v1 !== v2) this.value = v2;
						});

						$txt.on('input change', mediate);

						controls.sn.on('change', function () {
							var v1 = this.value;
							var v2 = fmt.Capitalize.all(v1);
							if (v1 !== v2) this.value = v2;
						});
						controls.gn.on('change', function () {
							var v1 = this.value;
							var v2 = fmt.Capitalize.start(v1);
							if (v1 !== v2) this.value = v2;
						});
					})();

					$update.on('click', function (evt) {
						if (!$update.hasClass("disabled")) {
							function telValue($jq) {
								var v = $jq.val();
								return v && _.isString(v) ? v.replace(/[^0-9.+() ]/g, "") : null;
							}

							var rq = {
								sn: controls.sn.val(),
								gn: controls.gn.val(),
								workMail: controls.workMail.val(),
								workTel: telValue(controls.workTel)
							};

							RT.jQuery.put({
								url: home.Route.accountHR,
								data: JSON.stringify(rq),
								contentType: "application/json",
								dataType: false
							}).then(function (rs) {
								return new Promise(function (resolve, reject) {
									if (rs.statusCode === 205) {
										console.log("account updated");
										location.reload();
										resolve("reload");
									}
									else {
										console.warn("unexpected response update result: %O", rs);
										reject(new Error("HTTP " + rs.statusCode));
									}
								});
							}).catch(function (fault) {
								console.error("account update fault", fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});

					mediate();
				}).catch(home.View.rejectHandler);
			}
		};
	}
);