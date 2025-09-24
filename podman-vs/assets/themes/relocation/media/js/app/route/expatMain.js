define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
	function (home, RT, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();

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

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				//home.View.title = txt.appName;
				home.View.actions = null;

				var tpl = {
					main: "expatMain"
				};
				var images = {
					mail: "ux-mail.svg",
					relocation: "ux-user.svg",
					appointments: "ux-calendar.svg",
					visits: "ux-home.svg",
					documents: "document_empty.svg",
					triangle: "shape_triangle.svg"
				};
				var model = {
					now: moment(),
					plannedVisits: null,
					communication: null,
					indicator: {
						relocation: {info: 0, warn: 0},
						appointments: {info: 0, warn: 0},
						visits: {info: 0, warn: 0},
						documents: {info: 0, warn: 0}
					},
					callToAction: {
						calendlyAppointmentRequired: false
					},
					welcomer: null,
					showWelcome: false
				};

				var deferred = [];

				var forceDashboard = "dashboard" === path[1];
				if (!forceDashboard) {
					if (path.length > 1) {
						home.go([path[0]]);
						return;
					}

					deferred.push(RT.jQuery.get({
						url: home.Route.accountExpat,
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						var w = rs.data.welcome;
						if (w.stage && !w.done) {
							console.log("expat(%s): welcome incomplete: %s", home.User.id, w.stage);
							model.showWelcome = true;
						}
					}));
				}

				deferred.push(RT.jQuery.get({
					url: home.Route.expatHome,
					contentType: false,
					dataType: "json"
				}).then(function (rs) {
					if (rs.data.welcomer) {
						model.welcomer = rs.data.contacts[rs.data.welcomer];
					}
					model.callToAction = rs.data.callToAction;
					model.communication = rs.data.communication;
					model.plannedVisits = _.chain(rs.data.plannedVisits)
						.filter(function (v) {
							return !v.cancelled && v.date && fmt.ISO8601.re.date.test(v.date);
						})
						.map(function (v) {
							v.datetime = v.date + " " + (v.time || "00:00:00");
							v.moment = cachedMoment(v.datetime);
							if (v.type) v.type = rs.data.visitTypes[v.type];
							return v;
						})
						.orderBy([function (v) {
							return v.datetime;
						}, "id"])
						.value();

					(function () {
						_.each(_.keys(model.indicator), function (k) {
							var m = model.indicator[k];
							var o = rs.data.indicator[k];
							for (var p in m) {
								if (_.isInteger(o[p]) && o[p] > 0) m[p] = o[p];
							}
						});

						var targets = {
							relocation: "expatRelocation",
							appointments: "otherVisits",
							visits: "expatVisits",
							documents: "expatDocs"
						};
						_.each(_.keys(targets), function (k) {
							model.indicator[k].target = targets[k];
						});
					})();
				}));

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all(deferred)
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						return;
					}

					if (model.showWelcome) {
						location.hash = "#welcome";
						return;
					}

					home.View.Pane.content[0].innerHTML = tpl.main(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
						cachedMoment: cachedMoment,
						isLocation: isLocation,
						toLocationText: toLocationText,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					$card.find('.homecard[data-target]').on('click', function () {
						var target = $(this).data("target");
						if (target) {
							home.Router.go([target]);
						}
					});
				}).catch(home.View.rejectHandler);
			}
		};
	}
);