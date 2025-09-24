define(
	['app/home', 'app/RT', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (home, RT, datePicker, $, _, moment) {
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

				if (!home.User.expat) throw new Error("forbidden");

				var tpl = {
					relocation: "expatRelocation",
					surveyListPane: "expatSurveyListPane"
				};
				var images = {
					todo: "ux-timer-todo.svg",
					done: "ux-timer-done.svg",
					warn: "sign_warning.svg",
					lock: "lock.svg",
					expand: "ux-circle-down.svg"
				};
				var model = {
					moment: {
						today: moment().startOf('day'),
						arrival: {
							max: moment().startOf("day").add(10, "year"),
							min: cachedMoment("2020-01-01")
						}
					},
					expat: null,
					surveys: null
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					RT.jQuery.get({
						url: home.Route.serviceStatus,
						contentType: false,
						dataType: "json"
					}),
					RT.jQuery.get({
						url: home.Route.expat + home.User.id,
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						model.expat = rs.data.expat;
					}),
					RT.jQuery.get({
						url: home.Route.survey + home.User.id + "/",
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						model.surveys = _.filter(rs.data.surveys, function (sd) {
							return !sd.hidden;
						});
					})
				]).then(function (result) {
					if (fnHasPathChanged()) {
						console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						return;
					}debugger;
					console.log(JSON.stringify(result[2]));
					home.View.documentTitle = txt.navExpatRelocation;
					home.View.Pane.content[0].innerHTML = tpl.relocation(_.assign({
						txt: txt,
						fmt: fmt,
						tpl: tpl,
						route: home.Route,
						user: home.User,
						images: images,
						status: result[2].data,
						cachedMoment: cachedMoment
					}, model));

					var $card = home.View.Pane.content.find('.card.relocation');

					var changeArrivalDate = (function () {
						var asyncStore = RT.Async.createAsyncStore({
							storeUri: home.Route.expatArrival + home.User.id,
							delayMillis: 500,
							afterStore: function (data) {
								console.log("stored arrivalDate: %s", data.arrivalDate);
							},
							afterError: function (data, fault, status) {
								console.error("failed to store arrivalDate: %s: %s", data.arrivalDate, fault, status);
							}
						});
						return function () {
							var $f = $('#accountArrivalDate');
							var dt = RT.jQuery.dateValue($f);
							if (dt) {
								var m = cachedMoment(dt);
								if (m.isSameOrAfter(model.moment.arrival.min, "day") && m.isBefore(model.moment.arrival.max, "day")) {
									asyncStore.data = {
										arrivalDate: dt
									};
								}
							}
						}
					})();

					$card.find('input.date').on('blur change', RT.jQuery.forceDateFormat);
					$('#accountArrivalDate').on('blur change', changeArrivalDate);

					$card.find('img[data-pick-date-for="accountArrivalDate"]').on('click', function () {
						var $icon = $(this);
						var $text = $('#' + $icon.data('pickDateFor'));

						var mm = model.moment;

						datePicker.create($text, $icon, {
							title: $icon.data('pickDateTitle'),
							defaultNavigationMonth: function () {
								var dnm = RT.jQuery.dateValue($text);
								if (dnm) {
									dnm = cachedMoment(dnm);
								}
								else {
									dnm = mm.today;
								}
								return dnm;
							},
							navigable: function (m/*, offset*/) {
								return m.isSameOrAfter(mm.arrival.min, "day");
							},
							selectable: function (m/*, mInitial*/) {
								return m.isSameOrAfter(mm.arrival.min, "day");
							}
						}).then(function (result) {
							if (moment.isMoment(result)) {
								changeArrivalDate();
							}
						}).catch(home.View.rejectHandler);
					});

					function clickSurveyCard() {
						var $sc = $(this)
						var surveyId = _.toInteger($sc.data("survey"));
						if (!_.isSafeInteger(surveyId) || surveyId < 1) {
							console.error("Can't get survey ID!");
							return;
						}
						if ($sc.hasClass("locked")) {
							console.warn("Survey %s: locked", surveyId);
							return;
						}

						var showSurvey = function () {
							return home.Router.go(["expatSurveys", home.User.id, surveyId]);
						}

						if ($sc.data("response") === 1) {
							showSurvey();
						}
						else {
							RT.jQuery.post({
								url: home.Route.survey + home.User.id + "/" + surveyId,
								data: JSON.stringify({
									respond: true
								}),
								contentType: "application/json",
								dataType: false
							}).then(function (rs) {
								return new Promise(function (resolve, reject) {
									if (rs.statusCode === 201) {
										console.log("survey(%s): response initialized", surveyId);
										home.Badge.invalidate();
										resolve(showSurvey());
									}
									else {
										console.warn("unexpected result: %O", rs);
										reject(new Error("HTTP " + rs.statusCode));
									}
								});
							}).catch(function (fault) {
								console.error("survey(%s): response initialization fault", surveyId, fault);
								home.View.warn = true;
							});
						}
					}

					$card.find('article.infocard.survey')
						.on('click', clickSurveyCard)
						.find('a').on('click', function (evt) {
						var $sc = $(this).closest('article');
						if ($sc.length) {
							clickSurveyCard.bind($sc[0])();
						}
						else {
							console.error("Can't find <article>!", this);
						}
						return RT.jQuery.cancelEvent(evt);
					});

					$card.find('.relocation-status-card-expand').click(function (evt) {
						evt.stopPropagation();


						var $card = $(this).closest('.relocation-status-card');
						if ($card.hasClass('relocation-status-card-closed')) {
							$card.removeClass('relocation-status-card-closed').addClass('relocation-status-card-open');
						}
						else {
							$card.removeClass('relocation-status-card-open').addClass('relocation-status-card-closed');
						}
					});
					$card.find('.relocation-status-nav > a').click(function (evt) {
						RT.jQuery.cancelEvent(evt);

						var $nav = $(this).closest('.relocation-status-nav');

						home.Router.go([$nav.data('nav')]);
					})

				}).catch(home.View.rejectHandler);
			}
		};
	}
);