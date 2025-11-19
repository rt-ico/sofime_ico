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

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				if (!home.User.expat) {
					throw new Error("forbidden");
				}

				home.View.actions = null;

				var tpl = {
					otherVisits: "otherVisits",
				};
				var model = {
					now: moment(),
					visits: null,
					visitType: null,
					rerouted: false
				};
				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.visitType = rs.data.visitType;

							return rs.statusCode;
						}),
						RT.jQuery.get({
							url: home.Route.activeExpatVisit + "*/" + home.User.id,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.visits = _.chain(rs.data.visits)
								.filter(function (v) {
									if (v.cancelled) return false;
									if (v.date && fmt.ISO8601.re.date.test(v.date)) {
										var dm = cachedMoment(v.date);
										if (dm.isBefore(MOMENT_TODAY, "d")) return false;
									}
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
						}),
						RT.jQuery.get({
							url: home.Route.expatView + "appointments/" + home.User.id,
							contentType: false,
							dataType: false
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
					home.View.documentTitle = txt.navOtherVisits;
					home.View.Pane.content[0].innerHTML = tpl.otherVisits(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						isLocation: isLocation,
						toLocationText: toLocationText,
						tpl: tpl,
						txt: txt,
						fmt: fmt
					}, model));

					home.Badge.invalidate();

					//var $card = home.View.Pane.content.find('div.card').eq(0);
				}).catch(home.View.rejectHandler);
			}
		};
	}
);