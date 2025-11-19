define(
	['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
	function (home, RT, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var lastViewedExpatId = null;

		var cachedMoment = RT.Time.createMomentCache();
		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.View.actions = null;
				home.Profile.requireSofime();

				let tpl = {
					card: "sfExpatView"
				};
				let model = {
					housingMode: false,
					expatId: _.toInteger(path[1]),
					expat: null,
					quickAccessSurveys: null,
					smallScreen: window.matchMedia("(max-width: 420px)").matches,
					tiles: [],
					badPath: false,
					rerouted: false
				};

				let images = {
					placeholder: "ux-cancel.svg",
					sfExpatEdit: "ux-user.svg",
					sfExpatDocs: "document_empty.svg",
					reviewSurveys:"ux-comment.svg",
					sfExpatVisit:"ux-calendar.svg",
					sfExpatHome:"ux-home.svg",
					sfExpatHomeSearch:"ux-clipboard.svg",
					sfExpatVisitPlace:"ux-photo.svg",
					sfExpatHomeSettle:"ux-home.svg",
					sfTodo:"ux-task-check.svg",
					sfMailSend:"ux-mail.svg",
					sfMailSent:"ux-mail.svg",
					sfExpatRelocationInfo:"environment.svg",
					sfExpatImmigration:"ux-immigration.svg",
					sfExpatSocialSecurity: "ux-add_box.svg"
				};

				if (path.length > 2) {
					if (path.length > 3) {
						model.badPath = true;
					}
					else if (path[2] === "housing") {
						model.housingMode = true;
					}
					else {
						model.badPath = true;
					}
				}
				if (path.length < 2 || !_.isSafeInteger(model.expatId) || model.expatId <= 0) {
					model.badPath = true;
				}
				if (model.badPath) {
					home.View.warn = true;
					home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
					return;
				}
				delete model.badPath;

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.survey,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.quickAccessSurveys = _.chain(rs.data.responses)
								.filter(function (sr) {
									return sr.expat.id === model.expatId && sr.survey.sfFrontQuickAccess;
								})
								.map(function (sr) {
									return sr.survey;
								}).sortBy("name").value();
						}),
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.service = rs.data.service;
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
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					let activateImmigration = false;
					let activateSocialSecurity = false;


					_.each(model.expat.services, function(it){
						if(it.isImmigration && it.isCreated)
						{
							activateImmigration = true;
						}
						if(it.isSocialSecurity && it.isCreated)
						{
							activateSocialSecurity = true;
						}
					});

					model.tiles.push({
						uri: "#sfExpatEdit/" + model.expatId,
						label: txt.actionViewExpat,
						thumb: 'sfExpatEdit',
						activate: true,
						housing: false
					});
					_.each(model.quickAccessSurveys, function (s) {
						model.tiles.push({
							uri: "#reviewSurveys/" + model.expatId + "/" + s.id,
							label: s.name,
							thumb: 'reviewSurveys',
							activate: true,
							housing: !!s.housing
						});
					});
					if(home.User.profile == 'SF' || home.User.profile =='CT'){
						model.tiles = model.tiles.concat([{
							uri: "#sfExpatRelocationInfo/" + model.expatId,
							label: txt.sfExpatRelocationInfo,
							thumb: 'sfExpatRelocationInfo',
							activate: true,
							housing: false
						}]);
					}
					model.tiles = model.tiles.concat([{
						uri: "#sfExpatDocs/" + model.expatId,
						label: txt.sfExpatDocuments,
						thumb: 'sfExpatDocs',
						activate: true,
						housing: false
					}, {
						uri: "#sfExpatView/" + model.expatId + "/housing",
						label: txt.sfExpatHome,
						thumb: 'sfExpatHome',
						activate: true,
						housing: false
					}]);
					if ( home.User.profile == 'SF' ){
						model.tiles = model.tiles.concat([{
							uri: "#sfExpatImmigration/" + model.expatId,
							label: txt.sfExpatImmigration,
							thumb: 'sfExpatImmigration',
							activate: activateImmigration,
							housing: false
						}, {
							uri: "#sfExpatSocialSecurity/" + model.expatId,
							label: txt.sfExpatSocialSecurity,
							thumb: 'sfExpatSocialSecurity',
							activate: activateSocialSecurity,
							housing: false
						}]);
					}

					model.tiles = model.tiles.concat([{
						uri: "#sfExpatHomeSearch/" + model.expatId,
						label: txt.sfExpatHomeSearch,
						thumb: 'sfExpatHomeSearch',
						activate: true,
						housing: true
					}, {
						uri: "#sfExpatVisitPlace/" + model.expatId,
						label: txt.sfExpatVisitPlaces,
						thumb: 'sfExpatVisitPlace',
						activate: true,
						housing: true
					}, {
						uri: "#sfExpatHomeSettle/" + model.expatId,
						label: txt.sfExpatHomeSettle,
						thumb: 'sfExpatHomeSettle',
						activate: true,
						housing: true
					},{
						uri: "#sfMailSend/desc/created/" + model.expatId + "/-",
						label: txt.navMailSendExpatView,
						thumb: 'sfMailSend',
						activate: true,
						housing: false
					}, {
						uri: "#sfMailSent/desc/created/" + model.expatId + "/-",
						label: txt.navMailSent,
						thumb: 'sfMailSent',
						activate: true,
						housing: false
					}, {
						uri: "#sfExpatVisit/" + model.expatId,
						label: txt.sfExpatVisits,
						thumb: 'sfExpatVisit',
						activate: true,
						housing: false
					},{
						uri: "#sfTodo/asc/deadline/-/" + model.expatId + "/-",
						label: txt.navSfTodo,
						thumb: 'sfTodo',
						activate: true,
						housing: false
					}
					]);


					model.tiles = _.filter(model.tiles, function (t) {
						return model.housingMode === !!t.housing;
					});

					home.View.warn = false;
					home.View.documentTitle = model.housingMode
						? model.expat.cn + " | " + txt.sfExpatHome
						: model.expat.cn;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					/*var $tiles = $card.find('article.sf-tile');
					RT.jQuery.setupHoverClass($tiles).on('click', function (evt) {
						var $el = $(this);
						var $a = this.tagName === "A" ? $el : $el.find('a[href]');
						location.href = $a.attr('href');
						return RT.jQuery.cancelEvent(evt);
					});*/

					let $expatViewCard = $card.find('div.expatViewCard');
					$expatViewCard.on('click', function (evt) {
						let $el = $(this);
						if(!($el.hasClass('disabled'))){
							location.href = $el.attr('href');
							return RT.jQuery.cancelEvent(evt);
						}
					});

					if (model.expat.id !== lastViewedExpatId) {
						var staffTrackViewUri = home.Route.staffView + "details/" + model.expat.id;
						RT.jQuery.get({
							url: staffTrackViewUri,
							contentType: false,
							dataType: false
						}).then(function (rs) {
							console.log("staffView:details: %s", rs.statusCode);
							lastViewedExpatId = model.expat.id; // don't hammer DB
						}).catch(function (fault) {
							console.error("%s: update fault.", staffTrackViewUri, fault);
							//home.View.warn = true;
						});
					}
				}).catch(home.View.rejectHandler);
			}
		};
	}
);