define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
	function (home, RT, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();
		var TIME_PATTERN = /^([0-9]{1,2})[ hH:.-]([0-9]{2})?$/;
		let smallScreen = window.matchMedia("(max-width: 420px)").matches;

		function toLocationPopup(location) {
			var lbl = "";
			if (_.isObject(location)) {
				if (location.address) {
					lbl += _.escape(location.address);
					if (location.postCode || location.city) lbl += "<br>";
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
					card: "sfExpatVisitPlace",
					popupSelectPlace: "sfExpatVisitPlaceSelect",
					popupSetTime: "sfExpatVisitPlaceTime"
				};
				var images = {
					download: "ux-download.svg",
					addVisitPlace: "ux-square-add.svg",
					phone: "ux-phone.svg"
				};
				var model = {
					expatId: _.toInteger(path[1]),
					expat: null,
					supplier: null,
					supplierType: null,
					rerouted: false
				};

				let planningReportId = -1;

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
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						fetchSuppliers(),
						RT.jQuery.get({
							url: home.Route.activeExpatVisit + "-/" + model.expatId,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.expat = rs.data.expat;
							model.visits = rs.data.visits;
							planningReportId = rs.data.planningReportId;
							_.each(model.visits, function (v) {
								_.each(v.places, function (p) {
									p.visitId = v.id;
									Object.defineProperty(p, "datetime", {
										get() {
											return (p.date || "0000-00-00") + " " + (p.time || "00:00:00");
										}
									});
								});
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

					var mapx = {
						coords: { // paris
							lat: 48.852969,
							lon: 2.349903
						},
						jobLocation: null,
						places: []
					};
					(function () {
						_.each(model.visits, function (v) {
							_.each(v.places, function (p) {
								if (_.isObject(p.location) && _.isObject(p.location.coords) && _.isNumber(p.location.coords.lat) && _.isNumber(p.location.coords.lon)) {
									mapx.places.push(p);
								}
							});
						});

						var pin;
						if (model.expat.job && model.expat.job.location && model.expat.job.location.coords) {
							pin = model.expat.job.location.coords;
							model.jobLocation = pin;
						}
						else if (mapx.places.length) {
							pin = mapx.places[0].location.coords;
						}
						if (pin) {
							mapx.coords.lat = pin.lat;
							mapx.coords.lon = pin.lon;
						}
					})();

					debugger;
					home.View.warn = false;
					home.View.documentTitle = model.expat.cn + " | " + txt.sfExpatVisitPlaces;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					var $map = $card.find('div.body > .map.visits').eq(0);
					var $cards = $card.find('.visitcards');

					// L = Leaflet.js
					// https://leafletjs.com/examples/quick-start/
					// https://leafletjs.com/reference-1.6.0.html#map
					var map = L.map($map.attr('id')).setView([mapx.coords.lat, mapx.coords.lon], mapx.places.length === 1 ? 15 : 11);

					L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
						attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					}).addTo(map);

					var markers = {};
					if (model.jobLocation) {
						markers[0] = L.marker([model.jobLocation.lat, model.jobLocation.lon]).addTo(map);
						markers[0].bindPopup(txt.expatriateJobLocation);
					}
					_.each(mapx.places, function (p) {
						var pin = p.location.coords;
						markers[p.id] = L.marker([pin.lat, pin.lon]).addTo(map);
						markers[p.id].bindPopup(toLocationPopup(p.location) || p.summary);
					});

					if (_.size(markers) > 1) {
						setTimeout(function () {
							var group = new L.featureGroup(_.values(markers));
							var bounds = group.getBounds().pad(0.2); // add 20% padding, to keep pins in viewport
							map.flyToBounds(bounds);
						}, 500);
					}

					if (window.ResizeObserver) {
						// handle window or <div#map> resize events to adjust map size & layout
						var rsz = new ResizeObserver(function (/*entries*/) {
							map.invalidateSize();
						});
						rsz.observe($map[0]);
					}

					var cardToData = function ($jq) {
						var $c = $jq.closest('.visitcard[data-v][data-p]');
						var data = {
							visit: null,
							place: null,
							date: $c.find('.visit-date').text().trim() || null,
							address: $c.find('.visit-address').attr('title').trim() || null
						};
						var visitId = $c.data("v");
						var placeId = $c.data("p");
						if (_.isInteger(visitId) && _.isInteger(placeId)) {
							data.visit = _.find(model.visits, function (v) {
								return visitId === v.id;
							}) || null;
							data.place = data.visit && _.isArray(data.visit.places) ? _.find(data.visit.places, function (p) {
								return placeId === p.id;
							}) || null : null;
						}
						if (data.visit && data.place) {
							console.log("expat_visit(%s)->expat_visit_place(%s): selected: %O", data.visit.id, data.place.id, data.place);
							return data;
						}
						return null;
					};

					var flyToPlace = function (data) {
						if (data && data.place) {
							var pin = markers[data.place.id];
							var ll = pin ? pin.getLatLng() : null;
							if (ll) {
								map.flyTo([ll.lat, ll.lng], 15);
							}
						}
					};

					var setVisitTime = function (data) {
						RT.Dialog.create({
							title: txt.sfSetVisitPlaceTime,
							sheet: true,
							width: 320,
							height: 280,
							actions: [{
								id: "updateTime",
								label: txt.actionUpdate,
								disabled: true
							}],
							dismiss: txt.actionCancel,
							content: function () {
								return tpl.popupSetTime({
									txt: txt,
									fmt: fmt,
									fields: {
										date: data.date,
										address: data.address
									},
									visit: data.visit,
									place: data.place
								});
							},
							onDisplay: function ($popup, fnDismiss, $header, $footer) {
								var $time = $popup.find('input[name="time"]');

								var $update = $footer.find('#updateTime');
								var mediate = function () {
									var time = toTime($time.val());

									var canSubmit = !!time;
									$update.prop("disabled", !canSubmit);
								};
								$time.on('input blur change', mediate);

								mediate();
								setTimeout(function () {
									$time.focus().select();
								}, 50);
							},
							onResolve: function ($pane, id) {
								if (id === "updateTime") {
									var time = toTime($pane.find('input[name="time"]').val());
									if (time) {
										return {
											dataset: "time",
											time: time
										};
									}
								}
								return id;
							}
						}).then(function (result) {
							if (_.isObject(result) && result.time) {
								RT.jQuery.put({
									url: home.Route.sfExpatVisitPlace + model.expatId + "/" + visit.id + "/" + place.id,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									console[rs.statusCode === 205 ? "log" : "warn"]("expat_visit_place(%s): set time to %s (status %s).", place.id, result.time, rs.statusCode);
									if (rs.statusCode === 205) {
										home.Router.update();
									}
									return rs.statusCode || 0;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("sfSetVisitPlaceTime: dialog fault", fault);
						});
					};

					var updatePlace = function (data) {
						home.Router.go(["sfExpatVisitPlaceEdit", model.expatId, data.visit.id, data.place.id]);
					};

					var selectPlace = function (data) {
						var dataChoices = {
							supplier: null
						};
						fetchSuppliers().then(function (/*rsStatusCode*/) {
							var compact = isCompact();

							return RT.Dialog.create({
								title: txt.actionSelect,
								sheet: !compact,
								width: 480,
								height: 360,
								actions: [{
									id: "select-vp",
									label: txt.actionSelect,
									disabled: true
								}],
								dismiss: txt.actionCancel,
								content: function () {
									return tpl.popupSelectPlace(_.assign({
										txt: txt,
										fmt: fmt,
										toLocationPopup: toLocationPopup
									}, data));
								},
								onDisplay: function ($popup, fnDismiss, $header, $footer) {
									var cs = data.place.supplier ? model.supplier[data.place.supplier.id] : null;
									if (cs) dataChoices.supplier = cs.id;

									var suppliers = _.chain(model.supplier)
										.values()
										.filter(function (s) {
											return (cs && cs.id === s.id) || (!s.archived && s.type && s.type.estateAgent);
										})
										.value().sort(function (a, b) {
											return home.Locale.compare(a.name, b.name) || a.id - b.id;
										});

									var $select = $footer.find('#select-vp');
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
											mediate();
										}
									});

									if (cs) {
										home.jQuery.setTypeAheadValue($supplier, cs);
									}

									var $addSupplier = $popup.find('a.add-supplier');
									$addSupplier.on("click", function (evt) {
										fnDismiss();
										home.Router.go(["sfSupplierContactEdit", 0]);
										return RT.jQuery.cancelEvent(evt);
									});

									var mediate = function () {
										$select.prop("disabled", !dataChoices.supplier);
									};
									mediate();
								},
								onResolve: function ($pane, id) {
									if (id === "select-vp" && dataChoices.supplier) {
										return {
											dataset: "selected",
											supplier: dataChoices.supplier,
											selected: true
										};
									}
									return id;
								}
							});
						}).then(function (result) {
							if (_.isObject(result) && result.hasOwnProperty("supplier")) {
								return RT.jQuery.put({
									url: home.Route.sfExpatVisitPlace + model.expat.id + "/" + data.visit.id + "/" + data.place.id,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									console[rs.statusCode === 205 ? "log" : "warn"]("expat_visit_place(%s): updated supplier (status %s).", data.place.id, rs.statusCode);
									if (rs.statusCode === 205) {
										home.Router.update();
									}
									return rs.statusCode || 0;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("select supplier: fault", fault);
							home.View.warn = true;
						});
					};

					var $recordCards = $cards.find('article[data-v][data-p]')
						.on("contextmenu", function (evt) {
							var data = cardToData($(this));
							if (data) {
								var menuItems = [{
									id: "sfSetVisitPlaceTime",
									label: txt.sfSetVisitPlaceTime,
								}, {
									id: "sfUpdateVisitPlace",
									label: txt.actionModify,
								}, {
									id: "sfSelectVisitPlace",
									label: txt.actionSelect,
								}];
								if (data.place && markers[data.place.id]) {
									menuItems.unshift({
										id: "flyToPlace",
										label: txt.flyToPlace,
									});
								}

								RT.Popup.create({
									title: data.address,
									top: evt.clientY - 8,
									left: evt.clientX - 8,
									width: 0,
									height: 0,
									items: menuItems
								}).then(function (result) {
									if (_.isObject(result) && _.isString(result.id)) {
										switch (result.id) {
											case "sfSetVisitPlaceTime":
												setVisitTime(data);
												break;
											case "sfUpdateVisitPlace":
												updatePlace(data);
												break;
											case "sfSelectVisitPlace":
												selectPlace(data);
												break;
											case "flyToPlace":
												flyToPlace(data);
												break;
										}
									}
									return result;
								});

							}

							return RT.jQuery.cancelEvent(evt);
						});

					$recordCards.find('.visit-address > a')
						.on("click", function (evt) {
							var data = cardToData($(this));
							if (data) flyToPlace(data);
							return RT.jQuery.cancelEvent(evt);
						});

					RT.jQuery.setupHoverClass($recordCards.find('a.visit-modify'), "default-primary-color")
						.on("click", function (evt) {
							var data = cardToData($(this));
							if (data) updatePlace(data);
							return RT.jQuery.cancelEvent(evt);
						});

					RT.jQuery.setupHoverClass($recordCards.find('a.visit-select.unselected'), "alt-accent-color");
					$recordCards.find('a.visit-select')
						.on("click", function (evt) {
							var data = cardToData($(this));
							if (data) selectPlace(data);
							return RT.jQuery.cancelEvent(evt);
						});

					RT.jQuery.setupHoverClass($cards.find('.add-card').eq(0))
						.on("click", function () {
							home.Router.go(["sfExpatVisitPlaceEdit", model.expatId, 0, 0]);
						});

					RT.jQuery.setupHoverClass($cards.find('.downloadPlanning')).on("click", function(evt){
						evt.stopPropagation();
						debugger;
						if(planningReportId > 0){
							window.open(home.Route.expatsStaffDocuments + '0/0/' + planningReportId + "/original?mtime" + "=", "_self");
							//window.open(home.Route.expatsStaffDocuments + '0/' + planningReportId + "/original?mtime=", "_blank");
						}
						else{
							new RT.Popup.create({
								title: txt.sfExpatVisitGeneratingReport,
								subtitle: txt.dialogPleaseReload,
								top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
								left: smallScreen ? 8 : evt.clientX - 8,
								width: smallScreen ? 344 : 0,
								height: 0,
								sheet: smallScreen,
								items: [{
									id: "Ok",
									label: txt.actionAccept
								}]
							})
						}
					});

				}).catch(home.View.rejectHandler);
			}
		};
	}
);