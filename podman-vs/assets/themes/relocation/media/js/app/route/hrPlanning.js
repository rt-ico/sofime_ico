define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
	function (home, RT, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.Profile.require("HR");
				home.View.actions = null;

				var tpl = {
					card: "hrPlanning"
				};
				var images = {
					expand: "ux-circle-down.svg",
				};
				var model = {
					moment: {
						today: moment().startOf("day")
					},
					visitType: null,
					ranges: null,
					expats: null,
					events: null,
					sort: {
						asc: null,
						att: null
					},
					filter: {
						range: path[3],
						expat: path[4],
						visitType: path[5]
					},
					rerouted: false
				};

				(function () {
					var f = model.filter;
					if (!_.isString(f.range) || f.range.length !== 1 || "fb-".indexOf(f.range) < 0) {
						f.range = "f";
						model.rerouted = true;
					}

					model.sort.asc = path[1] === "asc" ? true : path[1] === "desc" ? false : null;
					if (!_.isBoolean(model.sort.asc)) model.rerouted = true;

					model.sort.att = path[2];
					if (["date", "visitType", "expat"].indexOf(model.sort.att) < 0) {
						model.sort.att = null;
						model.rerouted = true;
					}

					_.each(["expat", "visitType"], function (k) {
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

				var go = function (o) {
					var f = ["range", "expat", "visitType"];
					var t = _.assign(_.pick(model.filter, f), _.pick(o, f));
					home.Router.go([path[0], model.sort.asc === false ? "desc" : "asc", model.sort.att || "date", t.range || "-", t.expat || "-", t.visitType || "-"]);
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
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.visitType = _.chain(rs.data.visitType)
								.orderBy(["name"])
								.value();
							model.visitType.unshift({
								id: 0,
								name: txt.reloEventTypeAll
							});
						}),
						RT.jQuery.get({
							url: home.Route.reloPlanning + model.filter.range + "/" + (model.filter.expat || "-") + "/" + (model.filter.visitType || "-"),
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.ranges = rs.data.ranges;
							model.expats = rs.data.expats.sort(function (a, b) {
								var x;
								if (!x) x = home.Locale.compare(a.sn, b.sn);
								if (!x) x = home.Locale.compare(a.gn, b.gn);
								return x !== 0 ? x : a.id - b.id;
							});
							_.each(model.expats, function (x) {
								x.getName = function () {
									return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
								};
								x.getName = x.getName.bind(x);
							});
							model.expats.unshift({
								id: 0,
								getName: _.constant(txt.reloExpatAll)
							});

							model.events = _.chain(rs.data.events)
								.filter(function (it) {
									return !it.cancelled;
								}).value();
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					(function () {
						function sortByDate(a, b) {
							var x = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
							if (!x && (a.time || b.time)) {
								x = a.time || "" > b.time || "" ? 1 : a.time || "" < b.time || "" ? -1 : 0;
							}
							return x;
						}

						function sortByType(a, b) {
							var x1 = _.find(model.visitType, function (o) {
								return o.id === a.type;
							});
							var x2 = _.find(model.visitType, function (o) {
								return o.id === b.type;
							});
							var x = home.Locale.compare(x1.localeName || x1.name, x2.localeName || x2.name);
							return x;
						}

						function sortByName(a, b) {
							var x1 = _.find(model.expats, function (o) {
								return o.id === a.expat;
							});
							var x2 = _.find(model.expats, function (o) {
								return o.id === b.expat;
							});
							var x;
							if (x1 && x2) {
								x = home.Locale.compare(x1.sn || "", x2.sn || "");
								if (!x) x = home.Locale.compare(x1.gn || "", x2.gn || "");
							}
							return x;
						}

						model.events.sort(function (a, b) {
							var x;
							switch (model.sort.att) {
								case "visitType": {
									x = sortByType(a, b);
									if (!x) x = sortByDate(a, b);
									if (!x) x = sortByName(a, b);
									break;
								}
								case "expat": {
									x = sortByName(a, b);
									if (!x) x = sortByDate(a, b);
									if (!x) x = sortByType(a, b);
									break;
								}
								default: {
									x = sortByDate(a, b);
									if (!x) x = sortByType(a, b);
									if (!x) x = sortByName(a, b);
								}
							}
							if (!x) x = a.id - b.id;
							if (x !== 0 && !model.sort.asc) x *= -1;
							return x;
						});
					})();

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						//tpl: tpl,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					var controls = {
						rangeExpand: $card.find('.icon.pick-date-range').eq(0),
						rangePicker: home.jQuery.createTypeAhead($card.find('.combo.pick-date-range input.combo').eq(0), {
							name: 'dateRange',
							identityKey: 'k',
							displayKey: 'v',
							normalize: true,
							limit: 10,
							minLength: 0,
							source: _.constant(_.values(model.ranges)),
							onSelect: function (v) {
								if (_.isObject(v) && v.k) {
									if (v.k !== model.filter.range) go({range: v.k});
								}
								else {
									setTimeout(setInitial.range, 10);
								}
							}
						}),
						expatExpand: $card.find('.icon.pick-expat').eq(0),
						expatPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-expat input.combo').eq(0), {
							name: 'expat',
							identityKey: 'id',
							displayKey: 'getName',
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(_.values(model.expats)),
							onSelect: function (v) {
								if (_.isObject(v) && _.isInteger(v.id)) {
									if (v.id !== model.filter.expat) go({expat: v.id});
								}
								else {
									setTimeout(setInitial.expat, 10);
								}
							}
						}),
						visitTypeExpand: $card.find('.icon.pick-visit-type').eq(0),
						visitTypePicker: home.jQuery.createTypeAhead($card.find('.combo.pick-visit-type input.combo').eq(0), {
							name: 'visitType',
							identityKey: 'id',
							displayKey: 'name',
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(_.values(model.visitType)),
							onSelect: function (v) {
								if (_.isObject(v) && _.isInteger(v.id)) {
									if (v.id !== model.filter.visitType) go({visitType: v.id});
								}
								else {
									setTimeout(setInitial.visitType, 10);
								}
							}
						})
					};

					var setInitial = {
						visitType: function () {
							var v = model.filter.visitType ? _.find(model.visitType, function (it) {
								return it.id === model.filter.visitType;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.visitTypePicker, v || model.visitType[0]);
						},
						range: function () {
							var v = _.find(model.ranges, function (it) {
								return it.k === model.filter.range;
							});
							home.jQuery.setTypeAheadValue(controls.rangePicker, v || model.ranges[0]);
						},
						expat: function () {
							var v = model.filter.expat ? _.find(model.expats, function (it) {
								return it.id === model.filter.expat;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.expatPicker, v || model.expats[0]);
						}
					};

					(function () {
						_.each(["range", "expat", "visitType"], function (k) {
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

					$card.find('th.sortable[data-col]').on('click', function () {
						var $th = $(this);
						var att = $th.data("col");
						var p = path.slice();
						p[1] = model.sort.asc && model.sort.att === att ? "desc" : "asc";
						p[2] = att;
						home.Router.go(p);
					});

				}).catch(home.View.rejectHandler);
			}
		};
	}
);