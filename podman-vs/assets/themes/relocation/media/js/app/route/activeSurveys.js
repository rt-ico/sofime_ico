define(
	['app/RT', 'app/home', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (RT, home, datePicker, $, _, moment) {
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
				//home.View.title = txt.navSurveys;
				home.View.actions = null;

				if (!home.User.staff) throw new Error("forbidden");
				home.Profile.require("SF");

				var tpl = {
					surveys: "activeSurveys"
				};
				var images = {
					expand: "ux-circle-down.svg",
				};
				var model = {
					expatId: null,
					handles: null,
					md: {
						survey: null,
						client: null,
						expat: null
					},
					tt: {
						get survey() {
							var dataset = _.values(model.md.survey).sort(function (a, b) {
								var x = home.Locale.compare(a.getName(), b.getName());
								return x === 0 ? a.id - b.id : x;
							});
							dataset.unshift({
								id: 0,
								name: txt.surveyAll
							});
							return dataset;
						},
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
								var x = home.Locale.compare(a.sn || "", b.sn || "");
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
					sort: {
						asc: null,
						att: null
					},
					filter: {
						survey: path[3],
						client: path[4],
						expat: path[5]
					},
					rerouted: false
				};

				(function () {
					var a = ["survey", "client", "expat"];
					var f = model.filter;

					model.sort.asc = path[1] === "asc" ? true : path[1] === "desc" ? false : null;
					if (!_.isBoolean(model.sort.asc)) model.rerouted = true;

					model.sort.att = path[2];
					if (a.indexOf(model.sort.att) < 0) {
						model.sort.att = null;
						model.rerouted = true;
					}

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
					var f = ["survey", "client", "expat"];
					var t = _.assign(_.pick(model.filter, f), _.pick(o, f));
					home.Router.go([path[0], model.sort.asc === false ? "desc" : "asc", model.sort.att || "survey", idParam(t.survey), idParam(t.client), idParam(t.expat)]);
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
							url: home.Route.surveyMasterData,
							contentType: false,
							dataType: "json"
						}).then(function (result) {
							model.md.survey = result.data.survey;
							model.md.client = result.data.client;
							model.md.expat = result.data.expat;

							_.each(model.md.survey, function (s) {
								s.getName = function () {
									return this.localeName || this.name || "";
								};
								s.getName = s.getName.bind(s);
							});

							_.each(model.md.expat, function (x) {
								if (x.client) {
									x.client = model.md.client[x.client];
								}
								x.getName = function () {
									return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
								};
								x.getName = x.getName.bind(x);
							});
						}),
						RT.jQuery.get({
							url: home.Route.surveyReviews + idParam(model.filter.expat) + "/" + idParam(model.filter.client) + "/" + idParam(model.filter.survey),
							contentType: false,
							dataType: "json"
						}).then(function (result) {
							model.handles = result.data.handles;
						})
					]).then(function (/*result*/) {
						_.each(model.handles, function (s) {
							var expatId = s.expat;
							s.expat = model.md.expat[expatId];
							if (!s.expat) {
								console.warn("expat(%s): unresolved!", expatId, s);
							}
						});
					})
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					(function () {
						function sortBySurvey(a, b) {
							return home.Locale.compare(a.localeName || a.name || "", b.localeName || b.name || "");
						}

						function sortByClient(a, b) {
							var c1 = a.expat != null ? a.expat.client : "";
							var c2 = b.expat != null ? b.expat.client : "";
							return home.Locale.compare(c1 ? c1.name : "", c2 ? c2.name : "");
						}

						function sortByExpat(a, b) {
							var x = home.Locale.compare((a.expat != null && a.expat.sn ) || "", (b.expat != null && b.expat.sn) || "");
							if (!x) x = home.Locale.compare((a.expat != null && a.expat.gn) || "", (b.expat && b.expat.gn) || "");
							return x;
						}

						model.handles.sort(function (a, b) {
							var x;
							switch (model.sort.att) {
								case "survey": {
									x = sortBySurvey(a, b);
									if (!x) x = sortByClient(a, b);
									if (!x) x = sortByExpat(a, b);
									break;
								}
								case "client": {
									x = sortByClient(a, b);
									if (!x) x = sortByExpat(a, b);
									if (!x) x = sortBySurvey(a, b);
									break;
								}
								default: {
									x = sortByExpat(a, b);
									if (!x) x = sortBySurvey(a, b);
									if (!x) x = sortByClient(a, b);
								}
							}
							if (!x) x = a.id - b.id;
							if (x !== 0 && !model.sort.asc) x *= -1;
							return x;
						});
					})();

					home.View.warn = false;
					home.View.documentTitle = txt.navSurveys;
					home.View.Pane.content[0].innerHTML = tpl.surveys(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					RT.jQuery.setupHoverClass($card.find('tr.survey'));

					var controls = {
						lock: $card.find('a.lock'),
						hide: $card.find('a.hide'),
						undo: $card.find('a.undo'),
						surveyExpand: $card.find('.icon.pick-survey').eq(0),
						surveyPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-survey input.combo').eq(0), {
							name: "survey",
							identityKey: "id",
							displayKey: "name",
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(model.tt.survey),
							onSelect: function (v) {
								if (_.isObject(v) && v.hasOwnProperty("id")) {
									if (v.id !== model.filter.survey) go({survey: v.id});
								}
								else {
									setTimeout(setInitial.survey, 10);
								}
							}
						}),
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
						survey: function () {
							var v = model.filter.survey ? _.find(model.tt.survey, function (it) {
								return it.id === model.filter.survey;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.surveyPicker, v || model.tt.survey[0]);
						},
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
						_.each(["survey", "client", "expat"], function (k) {
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

					function lookupHandle($a) {
						var $tr = $a.closest('tr[data-survey][data-expat]');
						var surveyId = $tr.data('survey');
						var expatId = $tr.data('expat');
						return surveyId && expatId ? _.find(model.handles, function (h) {
							return h.id === surveyId && h.expat.id === expatId;
						}) : null;
					}

					controls.lock.on('click', function (evt) {
						var $a = $(this);
						var handle = lookupHandle($a);
						if (handle) {
							var rq = {
								lock: _.isInteger(handle.lockId) ? handle.lockId : null,
								locked: !handle.locked
							};
							RT.jQuery.post({
								url: home.Route.surveyReviews + handle.expat.id + "/-/" + handle.id,
								data: JSON.stringify(rq),
								contentType: "application/json",
								//dataType: false
								dataType: "json"
							}).then(function (rs) {
								console.log("survey_handle(%s): expat(%s): locked: %s, status: %s", handle.id, handle.expat.id, rq.locked, rs.statusCode);
								handle.locked = rq.locked;
								if (!handle.lockId && _.isInteger(rs.data.lockId)) {
									handle.lockId = rs.data.lockId;
									var href = $a.attr('href');
									if (_.endsWith(href, '/')) $a.attr('href', href + handle.lockId);
								}
								$a.text(rq.locked ? txt.yes : txt.no);
							}).catch(function (fault) {
								console.error("survey_handle(%s): expat(%s): update fault.", handle.id, handle.expat.id, fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});
					controls.hide.on('click', function (evt) {
						var $a = $(this);
						var handle = lookupHandle($a);
						if (handle) {
							var rq = {
								hide: _.isInteger(handle.hideId) ? handle.hideId : null,
								hidden: !handle.hidden
							};
							RT.jQuery.post({
								url: home.Route.surveyReviews + handle.expat.id + "/-/" + handle.id,
								data: JSON.stringify(rq),
								contentType: "application/json",
								//dataType: false
								dataType: "json"
							}).then(function (rs) {
								console.log("survey_handle(%s): expat(%s): hidden: %s, status: %s", handle.id, handle.expat.id, rq.hidden, rs.statusCode);
								handle.hidden = rq.hidden;
								if (!handle.hideId && _.isInteger(rs.data.hideId)) {
									handle.hideId = rs.data.hideId;
									var href = $a.attr('href');
									if (_.endsWith(href, '/')) $a.attr('href', href + handle.hideId);
								}
								$a.text(rq.hidden ? txt.yes : txt.no);
							}).catch(function (fault) {
								console.error("survey_handle(%s): expat(%s): update fault.", handle.id, handle.expat.id, fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});
					controls.undo.on('click', function (evt) {
						var $a = $(this);
						var handle = lookupHandle($a);
						if (handle && _.isInteger(handle.response) && handle.done) {
							var rq = {
								response: handle.response,
								undo: true
							};
							RT.jQuery.post({
								url: home.Route.surveyReviews + handle.expat.id + "/-/" + handle.id,
								data: JSON.stringify(rq),
								contentType: "application/json",
								dataType: "json"
							}).then(function (rs) {
								console.log("survey_handle(%s): expat(%s): undo: %s, status: %s", handle.id, handle.expat.id, rq.undo, rs.statusCode);
								handle.done = false;
								var $td = $a.closest('td');
								$a.remove();
								$td.addClass('inactive').text(txt.no);
							}).catch(function (fault) {
								console.error("survey_handle(%s): expat(%s): update fault.", handle.id, handle.expat.id, fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});

					$card.find('th.sortable[data-col]').on('click', function () {
						var $th = $(this);
						var att = $th.data("col");
						var p = path.slice();
						p[1] = model.sort.asc && model.sort.att === att ? "desc" : "asc";
						p[2] = att;
						home.Router.go(p);
					});

					$card.find('tr.survey[data-survey][data-expat]')
						.on("contextmenu", function (evt) {
							var $tr = $(this);
							var handle = lookupHandle($tr);
							if (handle) {
								var $a_review = $tr.find('a.review');

								var menuItems = [];
								if ($a_review.length) {
									menuItems.push({
										id: "review",
										label: txt.actionReview
									});
								}

								RT.Popup.create({
									title: handle.name,
									subtitle: handle.expat.cn,
									top: evt.clientY - 8,
									left: evt.clientX - 8,
									width: 0,
									height: 0,
									items: menuItems
								}).then(function (result) {
									if (result && _.isString(result.id)) {
										switch (result.id) {
											case "review": {
												location.hash = $a_review.attr("href");
												break;
											}
										}
									}
									return result;
								});
							}
							return RT.jQuery.cancelEvent(evt);
						});

				}).catch(home.View.rejectHandler);
			}
		};
	}
);