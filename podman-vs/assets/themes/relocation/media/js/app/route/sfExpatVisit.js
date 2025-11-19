define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
	function (home, RT, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();
		var MOMENT_TODAY = moment().startOf('day');
		var TIME_PATTERN = /^([0-9]{1,2})[ hH:.-]([0-9]{2})?$/;

		function isLocation(location) {
			return _.isObject(location) && (location.address || location.city || location.postCode);
		}

		function toLocationText(location) {
			var lbl = "";
			if (_.isObject(location)) {
				if (location.address) {
					lbl += _.escape(location.address);
					if (location.postCode || location.city) lbl += ", ";
				}
				if (location.postCode) {
					lbl += _.escape(location.postCode);
				}
				if (location.city) {
					if (location.postCode) lbl += " ";
					lbl += _.escape(location.city);
				}
			}
			return lbl;
		}

		function toTime(s) {
			var match = TIME_PATTERN.exec(s);
			if (match) {
				var h = parseInt(match[1], 10);
				var m = parseInt(match[2] || "0", 10);
				if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
					return fmt.sprintf("%02d:%02d", h, m);
				}
			}
			return null;
		}

		function isCompact() {
			return window.matchMedia("(max-width: 800px)").matches;
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
					card: "sfExpatVisit",
					popupSetDateTime: "sfExpatAppointmentDateTime",
					popupSetAddress: "sfExpatAppointmentAddress",
					popupSetRemarks: "sfExpatAppointmentRemarks",
					popupSetSupplier: "sfExpatAppointmentSupplier"
				};
				var model = {
					expatId: _.toInteger(path[1]),
					expat: null,
					visits: null,
					visitType: null,
					supplier: null,
					supplierType: null,
					rerouted: false
				};

				if (path.length !== 2 || !_.isSafeInteger(model.expatId) || model.expatId <= 0) {
					home.View.warn = true;
					home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
					return;
				}

				var fetchSuppliers = function () {
					return RT.jQuery.get({
						url: home.Route.supplierData,
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						model.supplier = rs.data.supplier;
						model.supplierType = rs.data.supplierType;
						_.each(model.supplier, function (s) {
							s.type = model.supplierType[s.type];
						});
						return rs.statusCode;
					});
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all([
						fetchSuppliers(),
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.visitType = rs.data.visitType;

							return rs.statusCode;
						}),
						RT.jQuery.get({
							url: home.Route.sfExpat + model.expatId,
							contentType: false,
							dataType: "json"
						}).then(function (result) {
							model.expat = result.data.expat;
							if (!_.isObject(model.expat) || !model.expat.id || !model.expat.cn) {
								throw new Error("expat(" + model.expatId + "): unexpected response");
							}
						}),
						RT.jQuery.get({
							url: home.Route.activeExpatVisit + "*/" + model.expatId,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.visits = _.chain(rs.data.visits)
								.filter(function (v) {
									//if (v.cancelled) return false;

									return !v.cancelled;
									//return !v.cancelled && v.date && fmt.ISO8601.re.date.test(v.date);
								})
								.map(function (v) {
									if (v.date) {
										v.datetime = v.date + " " + (v.time || "00:00:00");
										v.moment = cachedMoment(v.datetime);
									}
									if (_.isObject(v.location) && _.size(_.keys(v.location)) > 0) {
										if (!(v.location.address && v.location.city && v.location.postCode)) {
											console.warn("expat_visit(%s): incomplete address for %s: %O", v.id, v.datetime || "(unscheduled)", v.location);
										}
									}
									else {
										v.location = {};
									}
									if (v.supplier) {
										v.supplier = rs.data.supplier[v.supplier];
									}
									return v;
								}).value().sort(function (a, b) {
									var x = 0;
									if (a.datetime || b.datetime) {
										x = (a.datetime && b.datetime) ? a.datetime - b.datetime : a.datetime ? -1 : 1;
									}
									return x || a.id - b.id;
								});

							var foundNext = false;
							_.each(model.visits, function (v) {
								if (v.moment) {
									if (v.moment.isSameOrAfter(MOMENT_TODAY, "day")) {
										if (!foundNext) {
											v.next = true;
											foundNext = true;
										}
									}
									else {
										v.past = true;
									}
								}
							});

							return rs.statusCode;
						})
					]).then(function (result) {
						_.each(model.visits, function (v) {
							v.type = model.visitType[v.type];
						});
						return result;

					})
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
						cachedMoment: cachedMoment,
						isLocation: isLocation,
						toLocationText: toLocationText,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					var $cards = RT.jQuery.setupHoverClass($card.find('article.infocard[data-v]'));

					var cardToAppointment = function ($card) {
						var id = $card.data("v");
						var appointment = _.isInteger(id) && id > 0 ? _.find(model.visits, function (v) {
							return v.id === id;
						}) : null;
						if (appointment) {
							console.log("expat_visit(%s): selected", appointment.id);
						}
						return appointment;
					};

					var showSetAppointmentDateTimePopup = function (appointment) {
						var compact = isCompact();

						return RT.Dialog.create({
							title: txt.sfSetAppointmentTime,
							sheet: !compact,
							width: 480,
							height: 280,
							actions: [{
								id: "updateDateTime",
								label: txt.actionUpdate,
								disabled: true
							}],
							dismiss: txt.actionCancel,
							content: function () {
								return tpl.popupSetDateTime({
									txt: txt,
									fmt: fmt,
									cachedMoment: cachedMoment,
									appointment: appointment
								});
							},
							onDisplay: function ($popup, fnDismiss, $header, $footer) {
								var $date = $popup.find('input[name="date"]');
								var $time = $popup.find('input[name="time"]');

								var $update = $footer.find('#updateDateTime');
								var mediate = function () {
									var dv = $date.val().trim();
									var tv = $time.val().trim();
									var date = dv ? RT.jQuery.dateValue($date) : null;
									var time = tv ? toTime(tv) : null;

									var canSubmit = true;
									if (dv || tv) {
										if (time && !date) canSubmit = false;
										if (canSubmit && dv && !date) canSubmit = false;
										if (canSubmit && tv && !time) canSubmit = false;
									}
									$update.prop("disabled", !canSubmit);
								};

								$date.on('blur change', RT.jQuery.forceDateFormat);
								RT.jQuery.selectOnFocus($date.add($time))
									.on('input blur change', mediate);

								mediate();
								setTimeout(function () {
									$date.focus().select();
								}, 50);
							},
							onResolve: function ($pane, id) {
								if (id === "updateDateTime") {
									var date = RT.jQuery.dateValue($pane.find('input[name="date"]'));
									var time = toTime($pane.find('input[name="time"]').val());
									return {
										dataset: "datetime",
										date: date || null,
										time: time || null
									};
								}
								return id;
							}
						}).then(function (result) {
							if (_.isObject(result) && result.hasOwnProperty("date") && result.hasOwnProperty("time")) {
								return RT.jQuery.put({
									url: home.Route.sfExpatAppointment + appointment.id,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									console[rs.statusCode === 205 ? "log" : "warn"]("expat_visit(%s): updated date & time (status %s).", appointment.id, rs.statusCode);
									if (rs.statusCode === 205) {
										home.Router.update();
									}
									return rs.statusCode || 0;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("update appointment: dialog fault", fault);
							home.View.warn = true;
						});
					};

					var showSetAppointmentAddress = function (appointment) {
						var compact = isCompact();

						return RT.Dialog.create({
							title: txt.sfAppointmentSetAddress,
							sheet: !compact,
							width: 480,
							height: 360,
							actions: [{
								id: "updateAddress",
								label: txt.actionUpdate
							}],
							dismiss: txt.actionCancel,
							content: function () {
								return tpl.popupSetAddress({
									txt: txt,
									fmt: fmt,
									appointment: appointment
								});
							},
							onDisplay: function ($popup, fnDismiss, $header, $footer) {
								var $address = $popup.find('input[name="address"]');
								var $city = $popup.find('input[name="city"]');
								var $postcode = $popup.find('input[name="postcode"]');

								var $txt = $address.add($city).add($postcode);
								RT.jQuery.selectOnFocus($txt);
								RT.jQuery.trimOnBlur($txt);

								$postcode.on('blur input change', function () {
									var v1 = this.value;
									var v2 = v1.replace(/\D/g, "");
									if (v1 !== v2) {
										this.value = v2;
									}
								});

								setTimeout(function () {
									$address.focus().select();
								}, 50);
							},
							onResolve: function ($pane, id) {
								if (id === "updateAddress") {
									return {
										dataset: "address",
										address: $pane.find('input[name="address"]').val(),
										city: $pane.find('input[name="city"]').val(),
										postcode: $pane.find('input[name="postcode"]').val()
									};
								}
								return id;
							}
						}).then(function (result) {
							if (_.isObject(result) && result.hasOwnProperty("address") && result.hasOwnProperty("city") && result.hasOwnProperty("postcode")) {
								return RT.jQuery.put({
									url: home.Route.sfExpatAppointment + appointment.id,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									console[rs.statusCode === 205 ? "log" : "warn"]("expat_visit(%s): updated address (status %s).", appointment.id, rs.statusCode);
									if (rs.statusCode === 205) {
										home.Router.update();
									}
									return rs.statusCode || 0;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("update appointment: dialog fault", fault);
							home.View.warn = true;
						});
					};

					var showSetAppointmentSupplier = function (appointment) {
						var compact = isCompact();

						var dataChoices = {
							supplier: null
						};

						fetchSuppliers().then(function (/*rsStatusCode*/) {
							return RT.Dialog.create({
								title: txt.sfAppointmentSetSupplier,
								sheet: !compact,
								width: 480,
								height: 360,
								actions: [{
									id: "updateSupplier",
									label: txt.actionUpdate
								}],
								dismiss: txt.actionCancel,
								content: function () {
									return tpl.popupSetSupplier({
										txt: txt,
										fmt: fmt,
										appointment: appointment
									});
								},
								onDisplay: function ($popup/*, fnDismiss, $header, $footer*/) {
									var cs = appointment.supplier ? model.supplier[appointment.supplier.id] : null;

									var suppliers = _.chain(model.supplier)
										.values()
										.filter(function (s) {
											return !s.archived || (cs && cs.id === s.id);
										})
										.value().sort(function (a, b) {
											return home.Locale.compare(a.name, b.name) || a.id - b.id;
										});

									var $supplier = home.jQuery.createTypeAhead($popup.find('input[name="supplier"]').eq(0), {
										name: "supplier",
										identityKey: "id",
										displayKey: "name",
										normalize: true,
										limit: 200,
										minLength: 0,
										source: _.constant(suppliers),
										onSelect: function (v) {
											dataChoices.supplier = (_.isObject(v) && v.id) ? v.id : null;
										}
									});

									if (cs) {
										home.jQuery.setTypeAheadValue($supplier, cs);
									}
								},
								onResolve: function ($pane, id) {
									if (id === "updateSupplier") {
										return {
											dataset: "supplier",
											supplier: dataChoices.supplier
										};
									}
									return id;
								}
							});
						}).then(function (result) {
							if (_.isObject(result) && result.hasOwnProperty("supplier")) {
								return RT.jQuery.put({
									url: home.Route.sfExpatAppointment + appointment.id,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									console[rs.statusCode === 205 ? "log" : "warn"]("expat_visit(%s): updated supplier (status %s).", appointment.id, rs.statusCode);
									if (rs.statusCode === 205) {
										home.Router.update();
									}
									return rs.statusCode || 0;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("update appointment: fault", fault);
							home.View.warn = true;
						});
					};

					var showSetAppointmentRemarks = function (appointment) {
						var compact = isCompact();

						return RT.Dialog.create({
							title: txt.sfAppointmentSetRemarks,
							sheet: !compact,
							width: 480,
							height: 320,
							actions: [{
								id: "updateRemarks",
								label: txt.actionUpdate
							}],
							dismiss: txt.actionCancel,
							content: function () {
								return tpl.popupSetRemarks({
									txt: txt,
									fmt: fmt,
									appointment: appointment
								});
							},
							onDisplay: function ($popup/*, fnDismiss, $header, $footer*/) {
								var $remarks = $popup.find('textarea[name="remarks"]');

								RT.jQuery.selectOnFocus($remarks);
								RT.jQuery.trimOnBlur($remarks);

								setTimeout(function () {
									$remarks.focus().select();
								}, 50);
							},
							onResolve: function ($pane, id) {
								if (id === "updateRemarks") {
									return {
										dataset: "remarks",
										remarks: $pane.find('textarea[name="remarks"]').val().trim()
									};
								}
								return id;
							}
						}).then(function (result) {
							if (_.isObject(result) && result.hasOwnProperty("remarks")) {
								return RT.jQuery.put({
									url: home.Route.sfExpatAppointment + appointment.id,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									console[rs.statusCode === 205 ? "log" : "warn"]("expat_visit(%s): updated remarks (status %s).", appointment.id, rs.statusCode);
									if (rs.statusCode === 205) {
										home.Router.update();
									}
									return rs.statusCode || 0;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("update appointment: dialog fault", fault);
							home.View.warn = true;
						});
					};

					$cards.on("click", function (/*evt*/) {
						var appointment = cardToAppointment($(this));
						if (appointment) showSetAppointmentDateTimePopup(appointment);
					}).on("contextmenu", function (evt) {
						var appointment = cardToAppointment($(this));
						if (appointment) {
							RT.Popup.create({
								title: appointment.localeDesc || appointment.subject,
								top: evt.clientY - 8,
								left: evt.clientX - 8,
								width: 0,
								height: 0,
								items: [{
									id: "setAppointmentTime",
									label: txt.sfSetAppointmentTime
								}, {
									id: "setAppointmentAddress",
									label: txt.addressToComplete
								}, {
									id: "setAppointmentSupplier",
									label: txt.pickSupplier
								}, {
									id: "setAppointmentRemarks",
									label: txt.colRemarks
								}]
							}).then(function (result) {
								if (_.isObject(result) && _.isString(result.id)) {
									switch (result.id) {
										case "setAppointmentTime":
											showSetAppointmentDateTimePopup(appointment);
											break;
										case "setAppointmentAddress":
											showSetAppointmentAddress(appointment);
											break
										case "setAppointmentSupplier":
											showSetAppointmentSupplier(appointment);
											break
										case "setAppointmentRemarks":
											showSetAppointmentRemarks(appointment);
											break
									}
								}
								return result;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});

					var $editAnchors = $cards.find('a.attr-edit').on("click", function (evt) {
						var $a = $(this);
						var $c = $a.closest('article.infocard[data-v]');

						var appointment = cardToAppointment($c);
						var href = $a.attr('href');

						if (appointment && href) {
							switch (href) {
								case "#set-address":
									showSetAppointmentAddress(appointment);
									break;
								case "#set-supplier":
									showSetAppointmentSupplier(appointment);
									break;
								case "#set-remarks":
									showSetAppointmentRemarks(appointment);
									break;
							}
						}
						return RT.jQuery.cancelEvent(evt);
					});

					RT.jQuery.setupHoverClass($editAnchors, 'underlined');

				}).catch(home.View.rejectHandler);
			}
		};
	}
);