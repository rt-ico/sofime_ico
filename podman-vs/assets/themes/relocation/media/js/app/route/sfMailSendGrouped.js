define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		// per-user and single-page session
		var cache = {
			comments: null
		};

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.View.actions = null;
				home.Profile.requireSofime();

				var tpl = {
					card: "sfMailSendGrouped"
				};
				var images = {
					expand: "ux-circle-down.svg",
				};
				var model = {
					md: {
						remarksExample: null,
						client: {},
						expat: {}
					},
					tt: {
						get client() {
							var dataset = _.values(model.md.client).sort(function (a, b) {
								var x = home.Locale.compare(a.name, b.name);
								return x === 0 ? a.id - b.id : x;
							});
							dataset.unshift({
								id: 0,
								name: "-"
							});
							return dataset;
						},
						get expat() {
							var dataset = _.values(model.md.expat);
							if (_.isInteger(model.filter.client)) {
								dataset = _.filter(dataset, function (x) {
									return x.client && x.client.id === model.filter.client;
								});
							}
							dataset.sort(function (a, b) {
								var x = home.Locale.compare(a.sn || "", b.sn || "");
								if (!x) x = home.Locale.compare(a.gn || "", b.gn || "");
								return x === 0 ? a.id - b.id : x;
							});
							dataset.unshift({
								id: 0,
								getName: _.constant("-")
							});
							return dataset;
						}
					},
					filter: {
						client: path[1],
						expat: path[2],
					},
					rerouted: false
				};

				(function () {
					var a = ["client", "expat"];
					var f = model.filter;

					_.each(a, function (k) {
						if (f[k] === "-") {
							f[k] = null;
							return; // continue
						}
						f[k] = (_.isString(f[k]) && f[k].length > 0) ? _.toInteger(f[k]) : null;
						if (!_.isSafeInteger(f[k]) || f[k] < 1) {
							f[k] = null;
							model.rerouted = true;
						}
					});
				})();

				function idParam(v) {
					return _.isInteger(v) && v > 0 ? v : "-";
				}

				var go = function (o) {
					var f = ["client", "expat"];
					var t = _.assign(_.pick(model.filter, f), _.pick(o, f));
					home.Router.go([path[0], idParam(t.client), idParam(t.expat)]);
				};
				if (model.rerouted) {
					go(model.filter);
					return;
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.sfAutoMailOutboxRequest,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.md.remarksExample = rs.data.remarksExample;
						}),
						RT.jQuery.get({
							url: home.Route.activeExpat,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							_.each(rs.data.expatriates, function (x) {
								if (!x.client || x.client.marketing) return; // continue

								if (_.isObject(model.md.client[x.client.id])) {
									x.client = model.md.client[x.client.id]; // overwrite duplicate definitions
								}
								else {
									model.md.client[x.client.id] = x.client;
								}

								model.md.expat[x.id] = x;

								x.getName = function () {
									return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
								};
								x.getName = x.getName.bind(x);
							});
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					var expat = model.filter.expat ? model.md.expat[model.filter.expat] : null;

					home.View.warn = false;
					home.View.documentTitle = txt.navMailSendGrouped;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
						expat: expat,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					var controls = {
						checkExpat: $card.find('.check-expat a'),
						clientExpand: $card.find('.icon.pick-client').eq(0),
						clientPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-client input.combo').eq(0), {
							name: "client",
							identityKey: "id",
							displayKey: "name",
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(model.tt.client),
							onSelect: function (v) {
								if (_.isObject(v) && v.hasOwnProperty("id")) {
									if (v.id !== model.filter.client) go({client: v.id});
								}
								else {
									setTimeout(setInitial.client, 10);
								}
							}
						}),
						expatExpand: $card.find('.icon.pick-expat').eq(0),
						expatPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-expat input.combo').eq(0), {
							name: "expat",
							identityKey: "id",
							displayKey: "getName",
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(model.tt.expat),
							onSelect: function (v) {
								if (_.isObject(v) && v.hasOwnProperty("id")) {
									if (v.id !== model.filter.expat) {
										var params = {expat: v.id};
										//if (v.client) params.client = v.client.id; // after tests, isn't very user-friendly after all
										go(params);
									}
								}
								else {
									setTimeout(setInitial.expat, 10);
								}
							}
						}),
						exampleComments: $card.find('#mg-comments-x'),
						comments: $card.find('#mg-comments'),
						update: $card.find('.footer a.update')
					};

					var setInitial = {
						client: function () {
							var v = model.filter.client ? _.find(model.tt.client, function (it) {
								return it.id === model.filter.client;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.clientPicker, v || model.tt.client[0]);
						},
						expat: function () {
							var v = model.filter.expat ? _.find(model.tt.expat, function (it) {
								return it.id === model.filter.expat;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.expatPicker, v || model.tt.expat[0]);
						}
					};

					(function () {
						_.each(["client", "expat"], function (k) {
							setInitial[k]();
							var p = controls[k + "Picker"];
							var x = controls[k + "Expand"];
							RT.jQuery.selectOnFocus(p.selector);
							x.on('click', function () {
								home.jQuery.setTypeAheadValue(p, null);
								p.selector.focus();
							});
						});
					})();

					controls.checkExpat.on("click", function (evt) {
						var $div = $(this).closest('div.check-expat');
						if ($div.hasClass("disabled")) return RT.jQuery.cancelEvent(evt);
					});

					RT.jQuery.selectOnFocus(controls.comments.add(controls.exampleComments));
					RT.jQuery.trimOnBlur(controls.comments).on("input change blur", function () {
						cache.comments = controls.comments.val();
						mediate();
					});

					if (cache.comments) {
						controls.comments.val(cache.comments);
					}

					controls.update.on("click", function (evt) {
						var $a = $(this);
						if ($a.length && !$a.hasClass("disabled")) {
							$a.addClass("disabled");

							home.View.inactive = true;

							RT.jQuery.post({
								url: home.Route.sfAutoMailOutboxRequest,
								data: JSON.stringify({
									expat: expat.id,
									comments: controls.comments.val()
								}),
								contentType: "application/json",
								dataType: false
							}).then(function (rs) {
								if (rs.statusCode === 201) {
									console.log("automail_request: created");
									cache.comments = null;

									return RT.Dialog.create({
										title: txt.navMailSendGrouped,
										sheet: true,
										width: 320,
										height: 240,
										content: function () {
											return '<p>' + _.escape(txt.groupMailRequestAdded) + '</p>';
										},
										dismiss: txt.actionClose
									}).then(function (/*result*/) {
										home.View.inactive = false;
										home.Router.go(["sfMessages"]);
									});
								}
								else {
									console.warn("automail_request: unexpected result: %O", rs);
									throw new Error("HTTP " + rs.statusCode);
								}
							}).catch(function (fault) {
								console.error("automail_request: creation fault", fault);
								home.View.warn = true;
							});
						}

						return RT.jQuery.cancelEvent(evt);
					});

					var mediate = function () {
						var canSubmit = _.isObject(expat);
						if (canSubmit) {
							canSubmit = !_.isEmpty(controls.comments.val());
						}
						RT.jQuery.withClassIf(controls.update, "disabled", !canSubmit);
					};

					mediate();

				}).catch(home.View.rejectHandler);
			}
		};
	}
);