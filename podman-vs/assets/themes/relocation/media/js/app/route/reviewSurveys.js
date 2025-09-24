define(
	['app/RT', 'app/home', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (RT, home, datePicker, $, _, moment) {
		"use strict";

		let ctx = null;
		let jst = null;
		let txt = RT.Text;
		let fmt = RT.Format;

		let cachedMoment = RT.Time.createMomentCache();

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				//home.View.title = txt.navReviewSurveys;
				home.View.actions = null;

				if (!home.User.staff) throw new Error("forbidden");

				let tpl = {
					review: "reviewSurveys"
				};
				let model = {
					expatId: null,
					surveyId: null,
					survey: null,
					review: null,
					responses: null,
					response: null,
					rerouted: false
				};

				if (path.length === 1) {
					home.Router.go(["activeSurveys"]);
					return;
				}

				model.expatId = _.toInteger(path[1]);
				model.surveyId = _.toInteger(path[2]);
				_.each(["expatId", "surveyId"], function (k) {
					if (!_.isInteger(model[k]) || model[k] < 1) {
						model[k] = null;
					}
				});
				if (!model.surveyId) {
					home.Router.go([path[0]]);
					return;
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.survey + (_.isInteger(model.expatId) ? model.expatId : "-") + "/" + (model.surveyId ? model.surveyId : ""),
							contentType: false,
							dataType: "json"
						}).then(function (result) {
							model.responses = result.data.responses;
							if (model.surveyId) {
								model.response = result.data.response;
								model.survey = model.response.survey;
								if (!_.isEmpty(model.survey.reviews) && home.User.staff) {
									model.review = _.find(model.survey.reviews, function (rvw) {
										return rvw.reviewer.id === home.User.id
									});
								}
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

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.review(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						txt: txt,
						fmt: fmt
					}, model));

					let $card = home.View.Pane.content.find('div.card').eq(0);
					RT.jQuery.selectOnFocus($card.find('input[type="text"], input[type="number"], textarea'));

					if (model.survey) {
						// mode: review survey response
						let restyled = RT.jQuery.restyleInputs($card);
						let $review = $card.find('textarea.review').eq(0);
						let $submit = $card.find('a[data-action="review"]').eq(0);
						let $submitRedirect = $card.find('a[data-action="review-toExpat"]').eq(0);
						let $submitUndo = $card.find('a[data-action="review-undo"]').eq(0);

						let mediate = function () {
							let canSubmit = true; //!_.isEmpty(("" + $review.val()).trim());

							RT.jQuery.withClassIf($submit.add($submitUndo).add($submitRedirect), "disabled", !canSubmit);
						};

						RT.jQuery.trimOnBlur($review)
							.on('input', mediate);

						$submit.add($submitUndo).add($submitRedirect).on('click', function (evt) {
							let $a = $(this);
							let cancel = false;
							if ($a.hasClass("disabled")) {
								cancel = true;
							}

							if (!cancel) {
								let rs = {
									review: $review.val().trim(),
									remarks: {}
								};
								if ($a.data('action') === 'review-undo') {
									rs.undo = true;
								}
								let toExpat = false;
								if ($a.data('action') === 'review-toExpat') {
									toExpat = true;
								}

								$card.find('input.answer-remarks[data-s="' + home.User.id + '"]').each(function () {
									let $i = $(this);
									let answerId = $i.data("a");
									let reviewId = $i.data("r");
									let t = $i.val().trim();
									if (_.isInteger(answerId) && answerId > 0 && t) {
										rs.remarks[answerId] = {
											text: t,
											answerId: answerId
										};
										if (_.isInteger(reviewId)) {
											rs.remarks[answerId].reviewId = reviewId;
										}
									}
								});

								RT.jQuery.put({
									url: home.Route.survey + model.expatId + "/" + model.surveyId,
									data: JSON.stringify(rs),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									return new Promise(function (resolve, reject) {
										if (rs.statusCode === 205) {
											console.log("survey(%s): response reviewed (undo: %s) for expat(%s)", model.surveyId, !!rs.undo, model.expatId);
											home.Badge.invalidate();
											debugger;
											if(toExpat){
												home.Router.go(["sfExpatView/" + model.expatId +"/"]);
											}else{
												home.Router.go([path[0]]);
											}

											resolve(rs.statusCode.toString());
										}
										else {
											console.warn("unexpected response review result: %O", rs);
											reject(new Error("HTTP " + rs.statusCode));
										}
									});
								}).catch(function (fault) {
									console.error("survey(%s): response review fault for expat(%s)", model.surveyId, model.expatId, fault);
									home.View.warn = true;
								});
							}

							RT.jQuery.cancelEvent(evt);
							return false;
						});

						mediate();
					}
					else if (model.responses) {
						// mode: select response from list

						let $rows = RT.jQuery.setupHoverClass($card.find('table.responses tr.response'));
						$rows.on('click', function (evt) {
							let t = evt.target.tagName;
							if (t === "TR" || t === "TD") {
								let href = $(evt.target).closest('tr.response').find('td.review-status a').eq(0).attr("href");
								if (href && href.indexOf("#") === 0) {
									location.hash = href;
								}
							}
						});

					}
				}).catch(home.View.rejectHandler);
			}
		};
	}
);