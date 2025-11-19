define(
	['app/home', 'app/RT', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (home, RT, datePicker, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();

		var RESTRICT_DELEGATE_EXPATS = false;

		function pickDefault(fnLookupOptions) {
			var options = fnLookupOptions();
			return options.length === 1 ? options[0] : null;
		}

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.View.actions = null;
				home.Profile.requireSofime();

				var tpl = {
					card: "sfMemo"
				};
				var model = {
					deadline: (function () {
						var today = moment().startOf('day');
						return {
							initial: today.clone().endOf('month'),
							upper: today.clone().add(10, 'year'),
							lower: today.clone().subtract(10, 'year')
						}
					})(),
					staff: null,
					delegate: {
						expat: null,
						task: null
					},
					expat: null,
					task: null
				};
				var dataChoices = {
					staff: home.User.id,
					expat: null,
					task: null
				};

				var deferred = [];
				if (home.User.profile === "SF") {
					deferred.push(RT.jQuery.get({
						url: home.Route.staffData + home.User.id,
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						var all = [];
						_.each(["SF", "CT"], function (k) {
							all = all.concat(rs.data[k]);
							_.each(rs.data[k], function (u) {
								u.profile = k;
							});
						});
						model.staff = _.keyBy(all, "id");
					}));
				}
				deferred.push(RT.jQuery.get({
					url: home.Route.staffMemoData,
					contentType: false,
					dataType: "json"
				}).then(function (rs) {
					if (home.User.profile === "SF" && _.isObject(rs.data.delegation) && _.size(rs.data.delegation)) {
						model.delegate.expat = {};
						model.delegate.task = {};
						_.each(rs.data.delegation, function (v, k) {
							if (_.isArray(v.expats) && v.expats.length) {
								model.delegate.expat[k] = v.expats;
							}
							if (_.isArray(v.freeTasks) && v.freeTasks.length) {
								model.delegate.task[k] = v.freeTasks;
							}
						});
					}
					model.expat = rs.data.memoExpats.sort(function (a, b) {
						var x = home.Locale.compare(a.sn, b.sn) || home.Locale.compare(a.gn, b.gn);
						return x ? x : a.id - b.id;
					});
					model.task = rs.data.memoTasks.sort(function (a, b) {
						var x = home.Locale.compare(a.name, b.name);
						return x ? x : a.id - b.id;
					});
				}));

				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all(deferred)
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					var lookup = {
						expat: (function () {
							if (RESTRICT_DELEGATE_EXPATS && model.staff && model.delegate.expat) {
								return function () {
									var options = [];
									if (dataChoices.staff) {
										var dx = model.delegate.expat[dataChoices.staff] || [];
										_.each(model.expat, function (x) {
											if (dx.indexOf(x.id) >= 0) options.push(x);
										});
									}
									return options;
								};
							}
							else {
								return _.constant(model.expat);
							}
						})(),
						task: (function () {
							if (model.staff && model.delegate.task) {
								return function () {
									var options = [];
									if (dataChoices.staff) {
										var dt = model.delegate.task[dataChoices.staff] || [];
										_.each(model.task, function (t) {
											if (dt.indexOf(t.id) >= 0) options.push(t);
										});
									}
									return options;
								};
							}
							else {
								return _.constant(model.task);
							}
						})()
					};

					home.View.warn = false;
					home.View.documentTitle = txt.navSfMemo;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					var controls = {
						staff: (function () {
							if (_.isObject(model.staff) && _.isObject(model.delegate.task)) {
								return home.jQuery.createTypeAhead($('#memo-staff'), {
									name: "memoStaff",
									identityKey: "id",
									displayKey: "cn",
									normalize: true,
									limit: 200,
									minLength: 0,
									source: (function () {
										var options = _.filter(_.values(model.staff), function (u) {
											return true;
										});
										return _.constant(options.sort(function (a, b) {
											var x = (a.profile > b.profile ? -1 : a.profile < b.profile ? 1 : 0) || home.Locale.compare(a.sn, b.sn) || home.Locale.compare(a.gn, b.gn);
											return x ? x : a.id - b.id;
										}));
									})(),
									/*(function () {
										var options = _.filter(_.values(model.staff), function (u) {
											if (u.id === home.User.id) return true;
											var t = _.chain(model.delegate.task[u.id] || [])
												.map(function (id) {
													return _.find(model.task, function (it) {
														return id === it.id;
													});
												}).filter(_.identity).value();
											return _.isArray(t) && t.length;
										});
										return _.constant(options.sort(function (a, b) {
											var x = (a.profile > b.profile ? -1 : a.profile < b.profile ? 1 : 0) || home.Locale.compare(a.sn, b.sn) || home.Locale.compare(a.gn, b.gn);
											return x ? x : a.id - b.id;
										}));
									})(),*/
									onSelect: function (v) {
										dataChoices.staff = v ? v.id : null;

										var clear = {expat: !v, task: !v};
										if (v) {
											_.each(_.keys(clear), function (k) {
												if (dataChoices[k]) {
													var a = model.delegate[k][dataChoices.staff] || [];
													clear[k] = a.indexOf(dataChoices[k]) < 0;
												}
											});
										}
										_.each(_.keys(clear), function (k) {
											if (clear[k]) {
												dataChoices[k] = null;
												home.jQuery.setTypeAheadValue(controls[k], null);
											}
											if (!dataChoices[k]) {
												var dv = pickDefault(lookup[k]);
												if (dv) {
													dataChoices[k] = dv.id;
													home.jQuery.setTypeAheadValue(controls[k], dv);
												}
											}
										});

										mediate();
									}
								});
							}
							return null;
						})(),
						expat: home.jQuery.createTypeAhead($('#memo-expat'), {
							name: "memoExpat",
							identityKey: "id",
							displayKey: "cn",
							normalize: true,
							limit: 200,
							minLength: 0,
							source: lookup.expat,
							onSelect: function (v) {
								dataChoices.expat = v ? v.id : null;
								mediate();
							}
						}),
						task: home.jQuery.createTypeAhead($('#memo-task'), {
							name: "memoTask",
							identityKey: "id",
							displayKey: "name",
							normalize: true,
							limit: 200,
							minLength: 0,
							source: lookup.task,
							onSelect: function (v) {
								dataChoices.task = v ? v.id : null;
								mediate();
							}
						}),
						deadline: $('#memo-deadline'),
						deadlinePicker: $card.find('img[data-pick-date-for="memo-deadline"]'),
						remarks: $('#memo-remarks'),
						createButton: $card.find('.footer a[href="#createMemo"]')
					};

					var mediate = function () {
						var canSubmit = true;
						if (model.staff && (model.delegate.expat || model.delegate.task)) {
							canSubmit = !!dataChoices.staff;
						}
						if (canSubmit) {
							canSubmit = !!(dataChoices.expat && dataChoices.task);
						}
						if (canSubmit) {
							canSubmit = !!RT.jQuery.dateValue(controls.deadline);
						}
						if (canSubmit) {
							canSubmit = !!controls.remarks.val().trim();
						}
						RT.jQuery.withClassIf(controls.createButton, "disabled", !canSubmit);
					};

					controls.deadlinePicker.click(function () {
						var $icon = $(this);
						var $text = $('#' + $icon.data('pickDateFor'));

						datePicker.create($text, $icon, {
							title: $icon.data('pickDateTitle'),
							defaultNavigationMonth: function () {
								var dnm = RT.jQuery.dateValue($text);
								if (dnm) {
									dnm = cachedMoment(dnm);
								}
								else {
									dnm = model.deadline.initial;
								}
								return dnm;
							},
							navigable: function (m/*, offset*/) {
								return m.isSameOrAfter(model.deadline.lower, 'day');
							},
							selectable: function (m/*, mInitial*/) {
								return m.isSameOrAfter(model.deadline.lower, 'day');
							}
						}).then(function (/*result*/) {
							// if (moment.isMoment(result)) { debugger; }
							mediate();
						}).catch(home.View.rejectHandler);
					});

					(function () {
						$card.find('input.date').on('blur change', RT.jQuery.forceDateFormat);

						var $txt = $card.find('input[type="text"]:not(.combo), textarea');
						RT.jQuery.selectOnFocus($txt.add(controls.expat.selector).add(controls.task.selector));
						RT.jQuery.trimOnBlur($txt);

						controls.remarks.on('input change', function () {
							mediate();
						});

						if (model.staff && model.delegate.task) {
							var s = _.find(model.staff, function (s) {
								return s.id === home.User.id;
							});
							if (s) {
								home.jQuery.setTypeAheadValue(controls.staff, s);
							}
						}
						_.each(_.keys(lookup), function (k) {
							var v = pickDefault(lookup[k]);
							if (v) {
								dataChoices[k] = v.id;
								home.jQuery.setTypeAheadValue(controls[k], v);
							}
						});
					})();

					controls.createButton.on('click', function (evt) {
						var $a = $(this);

						if (!$a.hasClass('disabled')) {
							$a.addClass('disabled'); // prevent re-click

							var rq = {
								expat: dataChoices.expat,
								task: dataChoices.task,
								deadline: RT.jQuery.dateValue(controls.deadline),
								remarks: controls.remarks.val()
							};
							if (model.staff && model.delegate.task && dataChoices.staff) {
								rq.staff = dataChoices.staff;
							}
							RT.jQuery.post({
								url: home.Route.staffMemoData,
								data: JSON.stringify(rq),
								contentType: "application/json",
								dataType: false
							}).then(function (rs) {
								if (rs.statusCode !== 201) { // CREATED
									console.warn("unexpected response update result: %O", rs.statusCode);
									throw new Error("HTTP " + rs.statusCode);
								}

								return RT.Dialog.create({
									sheet: true,
									overflow: true,
									title: txt.navSfMemo,
									width: 400,
									height: 280,
									dismiss: txt.actionClose,
									content: function () {
										return '<p>' + txt.memoCreated + '</p>';
									}
								});
							}).then(function (rs) {
								return new Promise(function (resolve /*, reject*/) {
									home.Router.go(["sfTodo"]);
									resolve("created");
								});
							}).catch(function (fault) {
								console.error("%s: expat(%s): POST fault.", $a.attr("href"), rq.expat, fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});

					//mediate();
				}).catch(home.View.rejectHandler);
			}
		};
	}
);