define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'app/route/documents/DocumentsArray'],
	function (home, RT, $, _, moment, DocumentsArray) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();

		var MAX_RELOCATIONS = 6;

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.Profile.require("HR");
				home.View.actions = null;

				var tpl = {
					card: "hrHome",
					minicards: "hrReloTrackMinicards"
				};
				var images = {
					expand: "ux-circle-down.svg",
					contract: "ux-circle-up.svg",
					folder: "ux-folder.svg",
					printer: "ux-printer.svg",
					trash: "ux-trash.svg",
					zoomIn: "ux-zoom-in.svg",
					edit: "ux-edit-3.svg",
					hide: "ux-eye-off.svg",
					upload: "ux-upload.svg",
					download: "ux-download.svg",
					triangle: "shape_triangle.svg"
				};
				var model = {
					moment: {
						today: moment().startOf("day")//,
						//relosAsOf: null,
						//relosUntil: null
					},
					expats: null,
					clients: null,
					service: null,
					rerouted: false,
					showDone: false,
					sortDone: {
						asc: null,
						att: null
					}
				};
				//model.moment.relosAsOf = model.moment.today.clone().subtract(1, "M");
				//model.moment.relosUntil = model.moment.today.clone().add(1, "M");

				if (path.length > 0) {
					model.sortDone.asc = "asc" === path[1] ? true : "desc" === path[1] ? false : null;
					model.sortDone.att = path[2];
					if (["expatCn", "name"].indexOf(model.sortDone.att) < 0) model.sortDone.att = null;

					if (model.sortDone.asc === null || model.sortDone.att === null) {
						model.rerouted = true;
						home.Router.go([path[0], model.sortDone.asc === "desc" ? "desc" : "asc", model.sortDone.att || "expatCn"]);
						return;
					}
				}

				console.log("fetching data for staff(%s): %s", home.User.id, home.User.uid);

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.service = rs.data.service;


						}),
						RT.jQuery.get({
							url: home.Route.reloTrack + "current",
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							if (_.isObject(rs.data.clients)) {
								model.clients = rs.data.clients;

								// create array of expats, with known arrival date, ordered by proximity of arrival date to current date
								model.expats = _.chain(rs.data.current)
									.filter(function (x) {
										if (!x.arrival) return false;
										var m = cachedMoment(x.arrival);
										return m.isValid(); // && m.isSameOrAfter(model.moment.relosAsOf, "d") && m.isSameOrBefore(model.moment.relosUntil, "d");
									})
									.each(function (x) {
										if (x.client) x.client = model.clients[x.client];
										x.arrivalProximity = Math.abs(model.moment.today.diff(cachedMoment(x.arrival), "d"));
									}).value().sort(function (a, b) {
										var x = a.arrivalProximity - b.arrivalProximity;
										if (!x) x = home.Locale.compare(a.arrival, b.arrival);
										return x ? x : a.id - b.id;
									});

								// truncate list of expats if necessary
								if (model.expats.length > MAX_RELOCATIONS) {
									model.expats = model.expats.slice(0, MAX_RELOCATIONS);
								};
								// sort list of expats
								model.expats.sort(function (a, b) {
									var x = home.Locale.compare(a.arrival, b.arrival);
									return x ? x : a.id - b.id;
								});
							}
							else {
								console.warn("unexpected response : %O", rs.data);
								throw new Error("unexpected response: " + rs.url);
							}
						}),
						RT.jQuery.get({
							url: home.Route.expatsStaffDocuments,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.documents = rs.data;
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}
					if(model.expats.length > 0 ) {
						let $serviceCards = home.View.Pane.content.find('div.expats').eq(0);
						_.each(model.expats, function(it){
							RT.jQuery.get({
								url:  home.Route.serviceStatus + it.id,
								contentType: false,
								dataType: "json"
							}).then(function(response){
								it.serviceStatus = response.data;
								$serviceCards.append(tpl.minicards (_.assign({
									route: home.Route,
									service: home.service,
									cachedMoment: cachedMoment,
									images: images,
									txt: txt,
									fmt: fmt,
								}, model)));

								//print(data.tpl.minicards(_.pick(data, ["expats", "service", "images", "cachedMoment", "txt", "fmt"])));
							})
						});


					}

					debugger;
					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						tpl: tpl,
						txt: txt,
						fmt: fmt
					}, model));


					model.documents.files.sort(function (a, b) {
						var x = 0;
						if (model.sortDone.att === "name") {
							x = (a.name ? 0 : 1) - (b.name ? 0 : 1);
							if (!x && a.name && b.name) {
								x = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
							}
						}
						if (!x) x = home.Locale.compare(a.expatSn, b.expatSn);
						if (!x) x = home.Locale.compare(a.expatGn, b.expatGn);
						return model.sortDone.asc ? x : x * -1;
					});

					new DocumentsArray(_.assign({
						card: '.documents-pane',
						path: path,
						menuUploadDocument: txt.expatDocumentRhBrowseTitle,
						menuBrowseDocument: txt.expatDocumentRhUploadTitle,
						uploadCount: model.documents.files.length,
						browseCount: model.documents.files.length,
						menu: null,
						filter: null,
						document_type: model.documents.document_type,
						sortDone: model.sortDone,
						documentBlocks: [{
							title: txt.rhViewExpatDocument,
							viewType: 'upload',
							enableFilter: false,
							count: true,
							canAdd: true,
							canDelete: true,
							canPrint: true,
							canDownload: true,
							canUpload: true,
							canOpen: true,
							emptyText: null,
							url: home.Route.expatsStaffDocuments,
							docs: model.documents.files
						}]
					}, ctx));


					var $card = home.View.Pane.content.find('div.card').eq(0);
					$card.find('div.expats.cards .minicard[data-id]').on('click', function () {
						var $el = $(this);
						var id = $el.data("id");
						if (_.isSafeInteger(id) && id > 0) {
							home.Router.go(["hrReloTrack", id]);
						}
					});
				}).catch(home.View.rejectHandler);
			}
		};
	}
);