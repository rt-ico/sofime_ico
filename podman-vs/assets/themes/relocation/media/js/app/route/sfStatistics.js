define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
	function (home, RT, $, _, moment) {
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
				home.View.actions = null;
				home.Profile.requireSofime();

				var tpl = {
					card: "sfStatistics"
				};
				var model = {
					storage: {
						client: null,
						documentType: null,
						relocationStatus: null
					},
					client: null,
					documentType: null,
					relocationStatus: null,
					units: {
						MiB: 1024 * 1024
					},
					rerouted: false
				};

				if (path.length === 1) {
					home.Router.go([path[0], "storage"]);
					model.rerouted = true;
					return
				}
				if (path.length !== 2 || path[1] !== "storage") {
					home.View.warn = true;
					home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
					model.rerouted = true;
					return;
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.relocationStatus = rs.data.relocationStatus;
						}),
						RT.jQuery.get({
							url: home.Route.staffStatistics,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.storage = rs.data.storage;
							model.client = rs.data.client;
							model.documentType = rs.data.documentType;
							model.documentType[0] = {
								id: 0,
								name: "Photo"
							};
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					_.each(model.storage.client, function (it) {
						it.client = model.client[it.client];
					});
					_.each(model.storage.relocationStatus, function (it) {
						it.status = model.relocationStatus[it.status];
					});
					_.each(model.storage.documentType, function (it) {
						if (it.type) {
							it.type = model.documentType[it.type];
						}
						else if (it.photo) {
							it.type = model.documentType[0];
						}
					});

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						txt: txt,
						fmt: fmt
					}, model));

					//var $card = home.View.Pane.content.find('div.card').eq(0);

					var gfx = {
						client: {
							chart: null,
							data: (function () {
								var clients = _.map(model.client, _.identity).sort(function (a, b) {
									var x = home.Locale.compare(a.name, b.name);
									return x ? x : a.id - b.id;
								});

								// todo: stacked bar chart for "xd", "xp", "cd", "sd", "gd" (need table-specific color scheme...), by adding datasets
								var data = {
									labels: _.map(clients, function (x) {
										return x.name
									}),
									datasets: [{
										label: "MiB",
										data: _.times(clients.length, _.constant(0)),
										backgroundColor: _.times(clients.length, _.constant('rgba(219, 94, 12, 0.6)')),
										borderColor: _.times(clients.length, _.constant('rgba(219, 94, 12, 0.9)')),
										borderWidth: 2
									}]
								};

								for (var i = 0; i < clients.length; i++) {
									_.each(model.storage.client, function (x) {
										if (x.client.id === clients[i].id) {
											data.datasets[0].data[i] += x.usage;
										}
									});
								}
								_.each(data.datasets, function (ds) {
									for (var i = 0; i < ds.data.length; i++) {
										ds.data[i] = Math.ceil(ds.data[i] / model.units.MiB);
									}
								});

								return data;
							})()
						},
						documentType: {
							chart: null,
							data: (function () {
								var types = _.map(model.documentType, _.identity).sort(function (a, b) {
									var x = home.Locale.compare(a.localeName || a.name, b.localeName || b.name);
									return x ? x : a.id - b.id;
								});

								// todo: stacked bar chart for "xd", "xp", "cd", "sd", "gd" (need table-specific color scheme...), by adding datasets
								var data = {
									labels: _.map(types, function (x) {
										return x.localeName || x.name
									}),
									datasets: [{
										label: "MiB",
										data: _.times(types.length, _.constant(0)),
										backgroundColor: _.times(types.length, _.constant('rgba(219, 94, 12, 0.6)')),
										borderColor: _.times(types.length, _.constant('rgba(219, 94, 12, 0.9)')),
										borderWidth: 2
									}]
								};

								for (var i = 0; i < types.length; i++) {
									_.each(model.storage.documentType, function (x) {
										if (x.type.id === types[i].id) {
											data.datasets[0].data[i] += x.usage;
										}
									});
								}
								_.each(data.datasets, function (ds) {
									for (var i = 0; i < ds.data.length; i++) {
										ds.data[i] = Math.ceil(ds.data[i] / model.units.MiB);
									}
								});

								return data;
							})()
						}
					}

					setTimeout(function () {
						var defaultOptions = {
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
						};
						gfx.client.chart = new Chart(RT.Canvas.fitToContainer('#gfx-canvas-client').getContext("2d"), {
							type: "bar",
							data: gfx.client.data,
							options: defaultOptions
						});
						gfx.documentType.chart = new Chart(RT.Canvas.fitToContainer('#gfx-canvas-documentType').getContext("2d"), {
							type: "bar",
							data: gfx.documentType.data,
							options: defaultOptions
						});
					}, 250);
				}).catch(home.View.rejectHandler);
			}
		};
	}
);