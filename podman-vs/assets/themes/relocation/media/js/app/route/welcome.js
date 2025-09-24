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
				//home.View.title = txt.appName;
				home.View.actions = null;

				var tpl = {
					welcome: "welcome"
				};
				var images = {
					todo: "ux-circle.svg",
					doing: "ux-timer-todo.svg",
					done: "ux-timer-done.svg",
					user: "ux-user.svg"
				};
				var model = {
					now: moment(),
					stages: null,
					welcome: null,
					welcomer: null,
					validatedServices: null
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.accountExpat,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.stages = rs.data.stages;
							model.welcome = rs.data.welcome;
						}),
						RT.jQuery.get({
							url: home.Route.expatHome,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							if (rs.data.welcomer) {
								model.welcomer = rs.data.contacts[rs.data.welcomer];
							}
							_.each(rs.data.validatedServices, function (s) {
								if (s.service) s.service = rs.data.services[s.service];
								if (s.contact) s.contact = rs.data.contacts[s.contact];
							});
							model.validatedServices = rs.data.validatedServices.sort(function (a, b) {
								var x = 0;
								if (a.service && b.service) {
									x = a.service.name < b.service.name ? -1 : a.service.name > b.service.name ? 1 : 0;
								}
								return x !== 0 ? x : a.id - b.id;
							});
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						return;
					}

					if (!model.welcome.stage) {
						throw new Error("nothing more to do here");
					}

					var targetStage = null;
                    if (!_.isEmpty(path[1])) {
                        targetStage = path[1];
                    }

					home.View.Pane.content[0].innerHTML = tpl.welcome(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
                        targetStage : targetStage,
						cachedMoment: cachedMoment,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					$card.find('img.avatar').on('error', function () {
						this.parentElement.innerHTML = images.user.toString();
					});

                    $card.find('.crumbtrail .crumb.done, .crumbtrail .crumb.doing').click(function (evt) {
                        var $stageDiv = $(this);

                        var stage = $stageDiv.data("stage");
                        console.log("expat(%s): posting \"%s\" stage update...", home.User.id, stage);
                        home.Router.go(['welcome', stage]);

                        return RT.jQuery.cancelEvent(evt);
                    });

					var $actions = $card.find('.homecard .actions a').click(function (evt) {
						var $a = $(this);
						if ($a.hasClass("disabled")) {
							return RT.jQuery.cancelEvent(evt);
						}

						$actions.addClass("disabled");

						var href = $a.attr("href");
                        var task = $a.data("stage");
						if (!task) {
							task = href;
							if (task.length > 1 && task.indexOf("#") === 0) {
								task = task.substring(1);
							}
						}
						if (!task || !_.isString(task)) {
							console.error("cannot proceed: " + (task || "?"));
							home.View.warn = true;
							return RT.jQuery.cancelEvent(evt);
						}
						var appointementTaken = (href.indexOf("mailto:") === 0) || (href.indexOf("https:") === 0) ;

						var rq = {
							stageDone: model.welcome.stage
						};

						var deferred;
						if (appointementTaken && navigator.sendBeacon) {
							deferred = new Promise(function (resolve, reject) {
								var dispatched = navigator.sendBeacon(
									home.Route.welcomeExpat,
									JSON.stringify(rq)
								);
								if (dispatched) {
									console.log("expat(%s): queued \"%s\" stage update beacon...", home.User.id, model.welcome.stage);
									resolve({
										statusCode: 202 // accepted
									});
								}
								else {
									console.warn("expat(%s): failed to queue \"%s\" stage update beacon!", home.User.id, model.welcome.stage);
									resolve({
										statusCode: 408 // timeout
									});
								}
							});
						}
						else {
							console.log("expat(%s): posting \"%s\" stage update...", home.User.id, model.welcome.stage);
							deferred = RT.jQuery.post({
								url: home.Route.welcomeExpat,
								data: JSON.stringify(rq),
								contentType: "application/json",
								dataType: false
							});
						}

						deferred.then(function (rs) {
							console.log("expat(%s): %s stage done (%s)", home.User.id, model.welcome.stage, rs.statusCode);

							switch (task) {
								case "welcome":
								case "skip": {
									if (model.welcome.next || model.welcome.ordinal === 0) {
										home.Router.update();
									}
									else {
										home.Router.goDefaultHashUri();
									}
									return task;
								}
								case "profile": {
									home.Router.go(["expatAccount"]);
									return task;
								}
								case "survey": {
									home.Router.go(["expatRelocation"]);
									return task;
								}
								case "document": {
									home.Router.go(["expatDocs"]);
									return task;
								}
								case "appointment": {
									if (!appointementTaken) {
										home.View.warn = true;
										throw new Error("\"mailto\" expected: " + task + "; got " + href);
									}
                                    home.Router.go(["expatMain"]);
									return task;
								}
								default: {
									home.View.warn = true;
									throw new Error("unimplemented task: " + task);
								}
							}
						}).catch(function (fault) {
							console.error("expat(%s): stage update fault.", home.User.id, fault);
							home.View.warn = true;
						});

						if (appointementTaken) return true;

						return RT.jQuery.cancelEvent(evt);
					});

				}).catch(home.View.rejectHandler);
			}
		};
	}
);