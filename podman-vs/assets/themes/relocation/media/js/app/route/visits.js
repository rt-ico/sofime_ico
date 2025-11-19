define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'app/route/visits/photoEditor'],
	function (home, RT, $, _, moment, photoEditor) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();

		var last = {
			read: 0,
			write: 0
		};

		function ts() {
			return new Date().getTime();
		}

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

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				//home.View.title = txt.navPlanning;
				home.View.actions = null;

				var tpl = {
					visits: "visits",
					editRemarks: "popupEditRemarks"
				};
				var images = {
					comment: "ux-comment.svg",
					photo: "ux-photo.svg"
				};
				var model = {
					expatId: parseInt(path[1], 10),
					expat: null,
					visits: null,
					rerouted: false
				};

				if (!_.isSafeInteger(model.expatId)) {
					throw new Error("bad uri: " + location.hash);
				}

				var deferred = [
					RT.jQuery.get({
						url: home.Route.activeExpatVisit + "-/" + model.expatId,
						contentType: false,
						dataType: "json"
					}).then(function (result) {
						model.expat = result.data.expat;
						model.visits = result.data.visits;
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
				];
				if (home.User.expat) {
					deferred.push(RT.jQuery.get({
						url: home.Route.expatView + "visits/" + home.User.id,
						contentType: false,
						dataType: false
					}).then(function (/*rs*/) {
						last.read = ts();
					}));
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all(deferred)
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

					home.View.warn = false;
					if (home.User.expat) {
						home.View.documentTitle = txt.navExpatVisits;
					}
					home.View.Pane.content[0].innerHTML = tpl.visits(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
						cachedMoment: cachedMoment,
						tpl: tpl,
						txt: txt,
						fmt: fmt
					}, model));

					home.Badge.invalidate();

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

					$card.find('.header a.job')
						.on('click', function (evt) {
							var pin = markers["0"];
							var ll = pin ? pin.getLatLng() : null;
							if (ll) {
								map.flyTo([ll.lat, ll.lng], 15);
							}

							RT.jQuery.cancelEvent(evt);
							return false;
						});

					$cards.find('.visit-address > a')
						.on('click', function (evt) {
							var placeId = $(this).closest('.visitcard[data-p]').data("p");
							if (_.isInteger(placeId)) {
								var pin = markers[placeId];
								var ll = pin ? pin.getLatLng() : null;
								if (ll) {
									map.flyTo([ll.lat, ll.lng], 15);
								}
							}

							return RT.jQuery.cancelEvent(evt);
						});

					if (home.User.expat) {
						var bindChoiceEvents = function () {
							// add "clickable" class to avoid same handler being added multiple times
							$cards.find('.action-box a.visit-choice:not(.clickable)')
								.on('click contextmenu', function (evt) {
									var $a = $(this);
									var $vc = $a.closest('.visitcard[data-v][data-p]');
									var placeId = $vc.data("p");
									var visitId = $vc.data("v");

									var visit = _.isInteger(visitId) ? _.find(model.visits, function (v) {
										return visitId === v.id;
									}) : null;
									var place = _.isInteger(placeId) && _.isObject(visit) && _.isArray(visit.places) ? _.find(visit.places, function (p) {
										return placeId === p.id;
									}) : null;

									if (visit && place) {
										var choiceCount = _.reduce(visit.places, function (sum, v) {
											return (v.choice1 || v.choice2 || v.choice3) ? sum + 1 : sum;
										}, 0);

										var deferred;
										if (choiceCount === 0) {
											deferred = new Promise(function (resolve) {
												resolve({
													id: "1",
													automatic: true
												});
											});
										}
										else {
											var prefs = choiceCount > 1 ? [1, 2, 3] : choiceCount > 0 ? [1, 2] : [1];
											if (prefs.length > choiceCount && (place.choice1 || place.choice2 || place.choice3)) {
												prefs.pop(); // can't add new choice unless place not yet chosen
											}

											var offset = $a.offset();
											deferred = RT.Popup.create({
												title: txt.colChoice,
												top: offset.top,
												left: offset.left,
												width: 0,
												height: 0,
												items: function () {
													var items = _.map(prefs, function (n) {
														return {
															id: n,
															label: fmt.sprintf(txt.nChoice, n)
														};
													});
													items.push({
														id: 0,
														label: txt.actionDeselect
													});
													return items;
												}
											});
										}

										deferred.then(function (deferredResult) {
											if (_.isObject(deferredResult) && _.isString(deferredResult.id) && /^[0-3]$/.test(deferredResult.id)) {
												var rq = {
													choice: _.toInteger(deferredResult.id)
												};
												console.log("expat_visit_place(%s): set choice := %O", place.id, rq.choice);
												return RT.jQuery.put({
													url: home.Route.expatVisitChoice + placeId,
													data: JSON.stringify(rq),
													contentType: "application/json",
													dataType: "json"
												}).then(function (rs) {
													last.write = ts();

													var prefs = rs.data;
													console.log("expat_visit_place(%s): choices: %O", place.id, prefs);
													_.each(visit.places, function (p) {
														delete p.choice1;
														delete p.choice2;
														delete p.choice3;
													});
													if (_.isArray(prefs) && prefs.length) {
														for (var i = 0; i < prefs.length; i++) {
															var p = _.find(visit.places, function (p) {
																return p.id === prefs[i];
															});
															if (p) p["choice" + (i + 1)] = true;
														}
													}

													$vc.closest('.visitcards').find('.visitcard[data-v="' + visitId + '"][data-p] a.visit-choice').each(function () {
														var $vc = $(this).closest('.visitcard[data-p]');
														var placeId = $vc.data("p");
														var place = _.isInteger(placeId) && placeId > 0 ? _.find(visit.places, function (p) {
															return p.id === placeId;
														}) : null;
														if (place) {
															if (place.choice1) {
																this.innerHTML = "1";
															}
															else if (place.choice2) {
																this.innerHTML = "2";
															}
															else if (place.choice3) {
																this.innerHTML = "3";
															}
															else {
																this.innerHTML = _.escape(txt.actionChoose);
															}
														}
													});
													bindChoiceEvents();

													if (deferredResult.automatic && prefs && prefs.length === 1) {
														return RT.Dialog.create({
															title: txt.colChoice,
															sheet: true,
															width: 320,
															height: 240,
															dismiss: txt.actionAccept,
															content: function () {
																return '<p>' + _.escape(txt.add2nd3rdChoice) + '</p>';
															}
														}).catch(function (fault) {
															console.error("choice add 2nd & 3rd dialog fault", fault);
														});
													}
												}).catch(function (fault) {
													console.error("choice update fault", fault);
													home.View.warn = true;
												});
											}
											return deferredResult;
										});
									}
									return RT.jQuery.cancelEvent(evt);
								})
								.addClass('clickable');
						};
						bindChoiceEvents();

						var bindRemarkEvents = function () {
							function placeOf($a) {
								var placeId = $a.closest('.visitcard[data-p]').data("p");
								return _.isInteger(placeId) ? _.chain(model.visits).map("places").flatten().find(function (p) {
									return p.id === placeId
								}).value() : null;
							}

							function setupContextualHover(m) {
								return function (/*evt*/) {
									var $a = $(this);
									var place = placeOf($a);
									if (place && place.remarks) {
										$a[m]("accent-color");
									}
								};
							}

							$cards.find('.action-box a.visit-photo')
								.on('click', function (evt) {
									var $a = $(this);
									var place = placeOf($a);
									if (place) {
										new photoEditor({
											refVisit: place.id,
											home: home,
											place: place,
											jst: jst,
											evt: evt
										})
									}
									return RT.jQuery.cancelEvent(evt);
								})
								.hover(
									setupContextualHover("addClass"),
									setupContextualHover("removeClass")
								);

							$cards.find('.action-box a.visit-remarks')
								.on('click', function (evt) {
									var $a = $(this);
									var place = placeOf($a);
									if (place) {
										var l = place.location;
										RT.Dialog.create({
											title: txt.colRemarks + (l && l.address ? " - " + l.address : ""),
											actions: [{
												id: "update-remarks",
												label: txt.actionUpdate
											}],
											dismiss: txt.actionCancel,
											content: function () {
												return tpl.editRemarks({
													place: place
												});
											},
											focusSelector: function () {
												return "#edit-remarks";
											},
											onResolve: function ($pane, id) {
												if ("update-remarks" === id) {
													return {
														remarks: $pane.find("#edit-remarks").val().trim()
													};
												}
												return id;
											}
										}).then(function (result) {
											if (_.isObject(result) && result.hasOwnProperty("remarks")) {
												return RT.jQuery.put({
													url: home.Route.activeExpatVisit + "-/" + model.expatId + "/" + place.visitId + "/" + place.id,
													//acceptErrorStatusCodes: [403, 409],
													data: JSON.stringify(result),
													contentType: "application/json",
													dataType: false
												}).then(function (/*rs*/) {
													last.write = ts();

													if (result.remarks) {
														place.remarks = result.remarks;
													}
													else {
														delete place.remarks;
													}
												});
											}
										}).catch(function (fault) {
											home.View.warn = true;
											console.error("dialog fault", fault);
										});
									}
									return RT.jQuery.cancelEvent(evt);
								})
								.hover(
									setupContextualHover("addClass"),
									setupContextualHover("removeClass")
								);
						};
						bindRemarkEvents();
					}
				}).catch(home.View.rejectHandler);
			},
			close: function (path, oldPath) {
				if (home.User.expat && (path[0] !== oldPath[0]) && (last.write > last.read)) {
					if (navigator.sendBeacon) {
						navigator.sendBeacon(
							home.Route.expatView + "visits",
							JSON.stringify({
								target: path[0]
							})
						);
						console.log("%s: leaving view after user-initiated update, marking as checked.", oldPath[0]);
					}
				}
			}
		};
	}
);