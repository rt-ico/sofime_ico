define(
	['app/home', 'app/RT', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (home, RT, datePicker, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();
		var TIME_PATTERN = /^([0-9]{1,2})[ hH:.-]([0-9]{2})?$/;
		var MOMENT_TODAY = moment().startOf('day');

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

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.View.actions = null;
				home.Profile.requireSofime();

				var tpl = {
					card: "sfExpatVisitPlaceEdit"
				};

				let model = {
					expat: null,
					expatId: path[1] ? parseInt(path[1], 10) : null,
					visitId: path[2] ? parseInt(path[2], 10) : null,
					visitPlaceId: path[3] ? parseInt(path[3], 10) : null,
					current: {
						visitType: null,
						visit: null,
						place: null
					},
					supplier: null,
					supplierType: null,
					rerouted: false
				};

				if (path.length >= 2 && path.length < 4) {
					home.Router.go([path[0], path[1], path[2] || "0", "0"]);
					model.rerouted = true;
					return;
				}
				if (path.length !== 4 || !(_.isInteger(model.expatId) && _.isInteger(model.visitId) && _.isInteger(model.visitPlaceId) && model.expatId > 0 && model.visitId >= 0 && model.visitPlaceId >= 0)) {
					home.View.warn = true;
					home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
					return;
				}

				var dataChoices = {
					supplier: null,
					submitted: false
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.sfExpat + model.expatId,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.expat = rs.data.expat;
							if (!_.isObject(model.expat) || !model.expat.id || !model.expat.cn) {
								throw new Error("expat(" + model.expatId + "): unexpected response");
							}
						}),
						RT.jQuery.get({
							url: home.Route.sfExpatVisitPlace + model.expatId + "/" + (model.visitId || "-") + "/" + (model.visitPlaceId || "-"),
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.current.visitType = _.chain(rs.data.visitType).values().head().value();
							model.current.visit = model.current.visitType ? _.chain(rs.data.visit)
								.each(function (v) {
									if (v.type === model.current.visitType.id) {
										v.type = model.current.visitType;
									}
								})
								.filter(function (v) {
									return _.isObject(v.type) && v.type.overridingVisitDate && v.type.usingPlaces && !v.archived;
								}).head().value() : null;
							if (_.isArray(rs.data.place) && rs.data.place.length) {
								model.current.place = rs.data.place[0];
							}
							model.transportations = rs.data.transportationTypes;
							model.current.refTransportation = rs.data.visit[0] ? rs.data.visit[0].refTransportation : null ;
						}),
						RT.jQuery.get({
							url: home.Route.supplierData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.supplier = rs.data.supplier;
							model.supplierType = rs.data.supplierType;
							_.each(model.supplier, function (s) {
								s.type = model.supplierType[s.type];
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

					if (model.current.place) {
						if (model.current.place.supplier) {
							model.current.place.supplier = model.supplier[model.current.place.supplier];
						}
					}

					model.expat.refTransportation = model.current.refTransportation;
					home.View.warn = false;
					home.View.documentTitle = model.expat.cn + " | " + txt.addVisitPlace;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					let controls = {
						restyled: RT.jQuery.restyleInputs($card),
						placeDate: $card.find('#evpPlaceDate'),
						placeTime: $card.find('#evpPlaceTime'),
						transportation: $card.find('input[name="transportation"]'),
						supplier: $card.find('#evpSupplier'),
						realEstateAgent: $card.find('#evpRealEstateAgent'),
						contactTel: $card.find('#evpContactTel'),
						summary: $card.find('#evpSummary'),
						remarks: $card.find('#evpExpatRemarks'),
						address: $card.find('#evpAddress'),
						city: $card.find('#evpCity'),
						postcode: $card.find('#evpPostcode'),
						urlAd: $card.find('#evpUrlAd'),
						surface: $card.find('#evpSurface'),
						price: $card.find('#evpPrice'),
						floor: $card.find('#evpFloor'),
						hasElevator: $card.find('#evpHasElevator'),
						isOffMarket: $card.find('#isOffMarket'),
						delete: $card.find('.footer a.delete'),
						update: $card.find('.footer a.update')
					};

					(function () {
						var cs;
						if (model.current.place && _.isObject(model.current.place.supplier)) {
							cs = model.current.place.supplier;
							dataChoices.supplier = cs.id;
						}

						var suppliers = _.chain(model.supplier)
							.values()
							.filter(function (s) {
								return (cs && cs.id === s.id) || (!s.archived && s.type && s.type.estateAgent);
							})
							.value().sort(function (a, b) {
								return home.Locale.compare(a.name, b.name) || a.id - b.id;
							});

						controls.supplier = home.jQuery.createTypeAhead(controls.supplier, {
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
							home.jQuery.setTypeAheadValue(controls.supplier, cs);
						}
					})();

					let mediate = function () {
						let canSubmit = !dataChoices.submitted;
						if (canSubmit) {
							let dv = RT.jQuery.dateValue(controls.placeDate);
							canSubmit = !!(dv);
							//let tv = toTime(controls.placeTime.val().trim());
							//canSubmit = !!(dv && tv);
						}
						if (canSubmit) {
							let tm = _.toInteger(controls.transportation.filter(':checked').val());
							canSubmit = !!(tm);
						}
						if (canSubmit) {
							let adUrl = controls.urlAd.val().trim();
							if (adUrl) {
								adUrl = RT.jQuery.urlValue(controls.urlAd);
								if (!adUrl) canSubmit = false;
							}
						}
						RT.jQuery.withClassIf(controls.update, "disabled", !canSubmit);
					};

					(function () {
						var $txt = controls.placeDate.add(controls.placeTime)
							.add(controls.realEstateAgent)
							.add(controls.summary)
							.add(controls.remarks)
							.add(controls.address)
							.add(controls.city)
							.add(controls.postcode)
							.add(controls.urlAd)
							.add(controls.surface)
							.add(controls.price)
							.add(controls.floor);
						RT.jQuery.selectOnFocus($txt);
						RT.jQuery.trimOnBlur($txt);

						controls.urlAd.on('blur change', function (evt) {
							var v = this.value.trim();
							if (v && v.indexOf("://") < 1) {
								v = "https://" + v;
								this.value = v;
							}
						});

						controls.placeDate.on('blur change', RT.jQuery.forceDateFormat);
						controls.placeTime.on('blur change', function () {
							var v1 = this.value.trim();
							var v2 = v1 ? toTime(v1) : null;
							if (v1 && v2 && v1 !== v2) {
								this.value = v2;
							}
						});
						controls.surface.add(controls.price).on('blur change', RT.jQuery.forceDecimalFormat);
						controls.postcode.on('blur input change', function () {
							var v1 = this.value;
							var v2 = v1.replace(/\D/g, "");
							if (v1 !== v2) {
								this.value = v2;
							}
						});
						controls.realEstateAgent.add(controls.city).on('change', function () {
							var v1 = this.value;
							var v2 = fmt.Capitalize.start(v1);
							if (v1 !== v2) this.value = v2;
						});

						function popupPlaceDatePicker() {
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
										dnm = MOMENT_TODAY;
									}
									return dnm;
								},
								navigable: function (m/*, offset*/) {
									return true;
								},
								selectable: function (m/*, mInitial*/) {
									return true;
								}
							}).then(function (/*result*/) {
								// if (moment.isMoment(result)) { debugger; }
								mediate();
							}).catch(home.View.rejectHandler);
						}

						$card.find('img.pick-place-date').on('click', popupPlaceDatePicker);
						controls.placeDate
							.add(controls.placeTime)
							.add(controls.urlAd)
							.add(controls.transportation)
							.on('blur change input', mediate);

						controls.update.on('click', function (evt) {
							if (!controls.update.hasClass("disabled")) {
								let rq = {
									dataset: "record",
									date: RT.jQuery.dateValue(controls.placeDate),
									time: toTime(controls.placeTime.val()),
									supplier: dataChoices.supplier,
									refTransportation: _.toInteger(controls.transportation.filter(':checked').val()),
									realEstateAgent: controls.realEstateAgent.val().trim() || null,
									contactTel: controls.contactTel.val().trim() || null,
									summary: controls.summary.val().trim() || null,
									remarks: controls.remarks.val().trim() || null,
									address: controls.address.val().trim() || null,
									city: controls.city.val().trim() || null,
									postcode: controls.postcode.val().trim() || null,
									urlAd: RT.jQuery.urlValue(controls.urlAd) || null,
									surface: RT.jQuery.decimalValue(controls.surface),
									price: RT.jQuery.decimalValue(controls.price),
									floor: controls.floor.val().trim() || null,
									hasElevator: controls.hasElevator.is(":checked"),
									isOffMarket: controls.isOffMarket.is(":checked")
								};

								RT.jQuery[model.current.place ? "put" : "post"]({
									url: home.Route.sfExpatVisitPlace + model.expatId + "/" + (model.visitId || "-") + "/" + (model.visitPlaceId || "-"),
									data: JSON.stringify(rq),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									var id = -1;
									var location = rs.jqXHR.getResponseHeader("Location");
									var endOfPathAt = _.isString(location) ? location.lastIndexOf('/') : -1;
									if (endOfPathAt >= 0 && endOfPathAt < location.length - 1) {
										id = _.toInteger(location.substring(endOfPathAt + 1));
									}
									var updated = rs.statusCode === 201 || rs.statusCode === 205;
									console[updated ? "log" : "warn"]("expat_visit_place(%s): stored (status %s).", id, rs.statusCode);
									if (updated) {
										home.Router.go(["sfExpatVisitPlace", model.expatId]);
									}
									return rs.statusCode || 0;
								}).catch(function (fault) {
									console.error("sfSetVisitPlace: fault", fault);
									home.View.warn = true;
								});

								controls.update.addClass("disabled");
								dataChoices.submitted = true;
							}
							RT.jQuery.cancelEvent(evt);
						});

						controls.delete.on('click', function (evt) {
							if (!controls.delete.hasClass("disabled")) {

								RT.Dialog.create({
									title: txt.actionDelete,
									warn: true,
									sheet: true,
									width: 320,
									height: 240,
									actions: [{
										id: "confirm-delete",
										label: txt.actionDelete
									}],
									dismiss: txt.actionCancel,
									content: function () {
										return '<p>' + _.escape(txt.confirmDeleteVisit) + '</p>';
									}
								}).then(function (result) {
									if (result !== "confirm-delete") return result;

									RT.jQuery.delete({
										url: home.Route.sfExpatVisitPlace + model.expatId + "/" + model.current.visit.id + "/" + model.current.place.id,
										contentType: false,
										dataType: false
									}).then(function (rs) {
										console.warn("expat_visit_place(%s): archived (status %s).", model.current.place.id, rs.statusCode);
										if (rs.statusCode === 205) {
											home.Router.go(["sfExpatVisitPlace", model.expatId]);
										}
										return rs.statusCode || 0;
									}).catch(function (fault) {
										console.error("sfSetVisitPlace: archive fault", fault);
										home.View.warn = true;
									});

									controls.delete.addClass("disabled");
								});
							}
							RT.jQuery.cancelEvent(evt);
						});
					})();

					RT.jQuery.setupHoverClass($card.find('.footer a.accent-ghost'));

					setTimeout(function () {
						controls.placeDate.focus().select();
					}, 100);
					mediate();
				}).catch(home.View.rejectHandler);
			}
		};
	}
);