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
                home.Profile.require("HR");

				var tpl = {
					visits: "hrVisits"
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
							});
						});
					})
				];

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