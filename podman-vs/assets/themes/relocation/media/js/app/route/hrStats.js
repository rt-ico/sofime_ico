define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		function sortByService(a, b) {
			return home.Locale.compare(a.localeName || a.name, b.localeName || b.name);
		}

		function sortByTotalUsage(a, b) {
			return a.totalUsage - b.totalUsage;
		}

		function roundIndicator(n, precision) {
			if (!_.isNumber(n)) n = 0;
			if (_.isInteger(n)) return n.toString();
			if (!_.isInteger(precision)) precision = 1;
			var p = Math.pow(10, precision);
			return fmt.formatDecimal(Math.round(n * p) / p, 1);
		}

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.Profile.require("HR");
				home.View.actions = null;

				var tpl = {
					card: "hrStats"
				};
				//var images = {};
				var model = {
					service: null,
					stats: {
						services: null,
						relocation: null,
					},
					sort: {
						asc: null,
						att: null
					},
					rerouted: false
				};

				(function () {
					model.sort.asc = path[1] === "asc" ? true : path[1] === "desc" ? false : null;
					if (!_.isBoolean(model.sort.asc)) model.rerouted = true;

					model.sort.att = path[2];
					if (["service", "projects"].indexOf(model.sort.att) < 0) {
						model.sort.att = null;
						model.rerouted = true;
					}
				})();

				if (model.rerouted) {
					home.Router.go([path[0], model.sort.asc === false ? "desc" : "asc", model.sort.att || "service"]);
					return;
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					//home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.service = rs.data.service;
						}),
						RT.jQuery.get({
							url: home.Route.reloStatsHR,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							_.assign(model.stats, _.pick(rs.data, ["services", "relocation"]));

							var sum = function (result, v/*, k*/) {
								return result + v;
							};
							var msr = model.stats.relocation;
							msr.total = _.reduce(msr.totalByYear, sum, 0);
							msr.meanSatisfaction = _.reduce(msr.meanSatisfactionByYear, sum, 0);
							if (msr.meanSatisfaction > 0 && msr.numYears) {
								var msTotalYears = _.keys(msr.meanSatisfactionByYear).length;
								if (msTotalYears > 1) msr.meanSatisfaction /= msr.numYears;
							}
							msr.maxSatisfaction = Math.abs(Math.max(10, msr.meanSatisfaction));

							var years = _.chain(_.keys(msr.totalByYear).concat(_.keys(msr.meanSatisfactionByYear)))
								.uniq().map(_.toInteger).value().sort();
							msr.minYear = _.min(years);
							msr.maxYear = _.max(years);
							msr.numYears = msr.minYear && msr.maxYear ? (msr.maxYear - msr.minYear + 1) : 0;

							msr.meanTotal = msr.total && msr.numYears ? msr.total / msr.numYears : 0;

							msr.currentYear = _.toInteger(_.max(_.keys(msr.totalByYear)));
							msr.currentTotal = msr.totalByYear[msr.currentYear];
						})
					]).then(function (/*result*/) {
						var tbs = model.stats.services.totalByService;
						model.stats.services.selection = _.chain(tbs)
							.keys().map(function (id) {
								var item = model.service[id];
								if (!item) {
									console.warn("service(%s): unresolved!", id);
								}
								item = _.assign({
									totalUsage: tbs[item.id]
								}, item);
								return item;
							}).filter(_.identity).value().sort(function (a, b) {
								var x;
								switch (model.sort.att) {
									case "projects": {
										x = sortByTotalUsage(a, b);
										if (!x) x = sortByService(a, b);
										break;
									}
									default: {
										x = sortByService(a, b);
										if (!x) x = sortByTotalUsage(a, b);
									}
								}
								if (!x) x = a.id - b.id;
								if (x !== 0 && !model.sort.asc) x *= -1;
								return x;
							});
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
						roundIndicator: roundIndicator,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					if (!_.isEmpty(model.stats.services.selection)) {
						$card.find('th.sortable[data-col]').on('click', function () {
							var $th = $(this);
							var att = $th.data("col");
							var p = path.slice();
							p[1] = model.sort.asc && model.sort.att === att ? "desc" : "asc";
							p[2] = att;
							home.Router.go(p);
						});

						(function () { // setup chart
							var selection = model.stats.services.selection.slice().sort(sortByService);

							setTimeout(function () {
								var canvas = RT.Canvas.fitToContainer('#gfx-canvas');
								var chart = new Chart(canvas.getContext('2d'), {
									type: 'bar',
									data: {
										labels: _.map(selection, function (it) {
											return (it.localeName || it.name)//.substring(0, 10);
										}),
										datasets: [{
											label: txt.statsRelosCounted,
											data: _.map(selection, function (it) {
												return it.totalUsage;
											}),
											backgroundColor: _.times(selection.length, _.constant('rgba(219, 94, 12, 0.6)')),
											borderColor: _.times(selection.length, _.constant('rgba(219, 94, 12, 0.9)')),
											borderWidth: 2
										}]
									},
									options: {
										responsive: true,
										maintainAspectRatio: false,
										scales: {
											xAxes: [{
												ticks: {
													autoSkip: false,
													maxRotation: 60,
													minRotation: 30
												}
											}],
											yAxes: [{
												ticks: {
													beginAtZero: true,
													min: 0
												}
											}]
										},
										layout: {
											padding: 16
										}
									}
								});
								home.Charts.track(chart);
							}, 250); // MUST wait until initial layout transition done, so that canvas size is calculated correctly
						})();
					}
				}).catch(home.View.rejectHandler);
			}
		};
	}
);