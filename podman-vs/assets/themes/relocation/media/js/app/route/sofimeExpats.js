define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();

		var goViewExpat = function (expat) {
			if (_.isObject(expat) && expat.id && expat.cn) {
				home.Router.go(["sfExpatView", expat.id]);
			}
			else {
				home.View.warn = true;
			}
		};

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				//home.View.title = txt.navSofimeExpats;
				home.View.actions = null;

				if (!home.User.staff) throw new Error("forbidden");

				var tpl = {
					expats: "sofimeExpats"
				};
				var images = {
					expand: "ux-circle-down.svg",
					addRelo: "ux-square-add.svg"
				};
				var model = {
					expats: null,
					checked: null,
					md: {
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
								name: txt.reloCustomerAll
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
                                var x = (a.uncheckDocument > 0 ? 1 : 0) - (b.uncheckDocument > 0 ? 1 : 0);
                                if (!x) x = home.Locale.compare(a.sn || "", b.sn || "");
								if (!x) x = home.Locale.compare(a.gn || "", b.gn || "");
								return x === 0 ? a.id - b.id : x;
							});
							dataset.unshift({
								id: 0,
								getName: _.constant(txt.reloExpatAll)
							});
							return dataset;
						}
					},
					filter: {
						client: path[1],
						expat: path[2]
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
							url: home.Route.sfExpat,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.expats = _.chain(rs.data.expatriates)
								.filter(function (x) {
									return !(x.client && x.client.marketing);
								}).value();
							_.each(model.expats, function (x) {
								model.md.expat[x.id] = x;

								if (_.isObject(x.client) && _.isInteger(x.client.id)) {
									if (_.isObject(model.md.client[x.client.id])) {
										x.client = model.md.client[x.client.id]; // overwrite duplicate definitions
									}
									else {
										model.md.client[x.client.id] = x.client;
									}
								}
								x.getName = function () {
									return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
								};
								x.getName = x.getName.bind(x);
							});

							if (model.filter.client) {
								model.expats = _.filter(model.expats, function (x) {
									return x.client && x.client.id === model.filter.client;
								});
							}
							if (model.filter.expat) {
								model.expats = _.filter(model.expats, function (x) {
									return x.id === model.filter.expat;
								});
								if (_.isEmpty(model.expats)) {
									model.rerouted = true;
									model.filter.expat = null;
									go(model.filter);
								}
							}
                            model.expats = model.expats.sort(function (a, b) {
                                var x = (a.uncheckDocument > 0 ? 1 : 0) - (b.uncheckDocument > 0 ? 1 : 0);
                                console.log("cmp x=" + x + ", num checked document=" + a.uncheckDocument);
                                if (!x) x = home.Locale.compare(a.sn || "", b.sn || "");
                                if (!x) x = home.Locale.compare(a.gn || "", b.gn || "");
                                console.log("full cmp x=" + x);
                                return x === 0 ? a.id - b.id : x;
                            });
						}),
						RT.jQuery.get({
							url: home.Route.staffExpatsChecked,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							if (!_.isArray(rs.data)) {
								throw new Error("staffExpatsChecked: array expected.");
							}
							model.checked = rs.data;
						})
					]).then(function (/*result*/) {
						_.each(model.checked, function (it) {
							var x = model.md.expat[it.id];
							if (x) {
								x.atime = it.ctime;
							}
						});
						model.expats.sort(function (a, b) {
							// reverse order required (most-recent access first, then most-recent creation order)
                            var x = (b.uncheckDocument > 0 ? 1 : 0) - (a.uncheckDocument > 0 ? 1 : 0);
                            if (!x) {
                                if (a.atime && b.atime) {
                                    x = b.atime - a.atime;
                                }
                                else if (a.atime || b.atime) {
                                    return a.atime ? 1 : -1;
                                }
                            }
							return x !== 0 ? x : b.ctime - a.ctime || b.id - a.id;
						});
					})
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}
					if (model.rerouted) {
						console.warn("Re-routed; cancelled rendering of #/%s", path.join("/"));
						return;
					}

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.expats(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
						cachedMoment: cachedMoment,
						txt: txt,
						fmt: fmt
					}, model));

					let $card = home.View.Pane.content.find('div.card').eq(0);

					var controls = {
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
									if (v.id !== model.filter.expat) go({expat: v.id});
								}
								else {
									setTimeout(setInitial.expat, 10);
								}
							}
						})
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

					let $addRelocation = $card.find('.addRelocation');

					RT.jQuery.setupHoverClass($addRelocation).on('click', function (evt) {
						evt.stopPropagation();
						home.Router.go(["sfExpatRelocationCreate"]);
					});

					var $cards = $card.find('article.expat[data-xp]');
					var getCardExpat = function ($tr) {
						var expat = $tr.data("xp");
						return expat ? _.find(model.expats, function (x) {
							return x.id === expat;
						}) : null;
					};

					$cards.on("contextmenu", function (evt) {
						var expat = getCardExpat($(this));
						if (!expat) return RT.jQuery.cancelEvent(evt);

						RT.Popup.create({
							title: expat.cn,
							top: evt.clientY - 8,
							left: evt.clientX - 8,
							width: 0,
							height: 0,
							items: [{
								id: "goView",
								label: txt.actionViewExpat,
							}]
						}).then(function (result) {
							if (_.isObject(result) && _.isString(result.id)) {
								switch (result.id) {
									case "goView":
										goViewExpat(expat);
										break;
								}
							}
							return result;
						});

						return RT.jQuery.cancelEvent(evt);
					});

					RT.jQuery.setupHoverClass($cards).on('click', function () {
						goViewExpat(getCardExpat($(this)));
					});

				}).catch(home.View.rejectHandler);
			}
		};
	}
);