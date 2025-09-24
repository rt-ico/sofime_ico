define(
	['app/RT', 'app/home', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (RT, home, datePicker, $, _, moment) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		var cachedMoment = RT.Time.createMomentCache();
		var MOMENT_TODAY = moment().startOf('day');

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				//home.View.title = txt.navExpatSurveys;
				home.View.actions = null;

				var tpl = {
					surveys: "expatSurveys",
					surveyListCard: "expatSurveyListCard",
					surveyListPane: "expatSurveyListPane",
					sections: "expatSurveySections"
				};
				var images = {
					todo: "ux-timer-todo.svg",
					done: "ux-timer-done.svg",
					warn: "sign_warning.svg",
					lock: "lock.svg"
				};
				var model = {
					expatId: null,
					surveyId: null,
					survey: null,
					sectionId: null,
					section: null,
					sections: {
						selectable: null,
						get required() {
							return _.filter(model.sections.selectable, function (s) {
								return s.isRequired();
							});
						},
						get currentIndex() {
							var ci = model.section && model.sections.selectable ? _.findIndex(model.sections.selectable, function (it) {
								return it.id === model.section.id;
							}) : -1;
							return _.isInteger(ci) && ci >= 0 ? ci : -1;
						},
						get prev() {
							var mss = model.sections.selectable;
							var ci = model.sections.currentIndex;
							if (ci < 1) return null;
							for (var i = ci - 1; i >= 0; i--) {
								var s = mss[i];
								if (s.isRequired()) return s;
							}
							return null;
						},
						get next() {
							var mss = model.sections.selectable;
							var ci = model.sections.currentIndex;
							if (ci < 0 || ci >= mss.length - 1) return null;
							for (var i = ci + 1; i < mss.length; i++) {
								var s = model.sections.selectable[i];
								if (s.isRequired()) return s;
							}
							return null;
						},
						get nextConditional() {
							var mss = model.sections.selectable;
							var ci = model.sections.currentIndex;
							if (ci < 0 || ci >= mss.length - 1) return null;
							for (var i = ci + 1; i < mss.length; i++) {
								var s = model.sections.selectable[i];
								if (s.isConditional()) return s;
							}
							return null;
						},
						isNavigable: function () {
							var mss = model.sections.selectable;
							return !!(model.section && _.isArray(mss) && mss.length);
						},
						isLast: function () {
							var mss = model.sections.selectable;
							return model.section && _.isArray(mss) && mss.length && model.section.id === mss[mss.length - 1].id;
						}
					},
					surveys: null,
					response: null,
					get locked() {
						return model.response && model.response.done;
					},
					rerouted: false
				};

				if (path.length > 1) {
					model.expatId = _.toInteger(path[1]);
					model.surveyId = _.toInteger(path[2]);
					model.sectionId = _.toInteger(path[3]);
					_.each(["expatId", "surveyId"], function (k) {
						if (!_.isInteger(model[k]) || model[k] < 1) {
							model[k] = null;
						}
					});
					if (!model.surveyId) {
						home.Router.go([path[0]]);
						return;
					}
					if (home.User.expat) {
						if (model.expatId && model.expatId !== home.User.id) {
							home.Router.go([path[0]]);
							return;
						}
						if (!model.expatId) model.expatId = home.User.id;
					}
				}

				if (model.surveyId) {
					delete tpl.surveyListCard;
					delete tpl.surveyListPane;
				}
				if (!model.surveyId || model.sectionId) {
					delete tpl.sections;
				}

				var deferred = [
					jst.fetchTemplates(tpl),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.survey + (home.User.expat ? home.User.id : "-") + "/" + (model.surveyId ? model.surveyId : ""),
							contentType: false,
							dataType: "json"
						}).then(function (result) {
							model.surveys = _.filter(result.data.surveys, function (sd) {
								return !sd.hidden;
							});
							if (model.surveyId) {
								model.response = result.data.response;
								model.survey = model.response.survey;

								_.each(model.survey.sections, function (s) {
									s.isRequired = _.stubFalse;
									s.isConditional = function () {
										return !!(_.isArray(s.prerequisiteOptions) && s.prerequisiteOptions.length);
									}
								});

								model.sections.selectable = _.chain(model.survey.sections)
									.filter(function (it) {
										var qActive = _.find(it.surveyQuestions, function (sq) {
											var q = model.survey.questions[sq.questionId];
											if (q && (q.type === "Radio" || q.type === "Checkbox")) {
												if (_.isEmpty(q.selectableOptions)) {
													console.warn("section(%s): \"%s\" question(%s) has no selectable options!", it.id, q.type, q.id);
													return false;
												}
											}
											return q && !sq.archived;
										});
										var qWithA = _.find(it.surveyQuestions, function (sq) {
											return _.isArray(sq.answers);
										});
										var retain = _.isObject(qWithA) || (_.isObject(qActive) && !it.archived);
										if (!retain && !_.isObject(qWithA) && !_.isObject(qActive)) {
											console.warn("section(%s): not selectable, no answers and no valid questions!", it.id);
										}
										return retain;
									}).orderBy(["displayOrder", "name"]).value();

								_.each(model.sections.selectable, function (s) {
									if (_.isArray(s.prerequisiteOptions) && s.prerequisiteOptions.length) {
										s.isRequired = function () {
											var selected = [];
											var $options = $('.card.surveys:first ul.questions:first li input.option.predefined:checked');
											var prerequisiteOptionIds = s.prerequisiteOptions.slice();
											for (var i = 0; i < prerequisiteOptionIds.length; i++) {
												_.each(model.survey.sections, function (it) {
													var optionId;
													if (it.id === model.sectionId) {
														var $o = $options.filter('[value="' + prerequisiteOptionIds[i] + '"]');
														if ($o.length === 1) {
															optionId = _.toInteger($o.val());
														}
													}
													else {
														_.each(it.surveyQuestions, function (sq) {
															if (!_.isArray(sq.answers)) return;
															_.each(sq.answers, function (a) {
																if (!_.isObject(a.choices)) return;
																var c = _.find(a.choices, function (c) {
																	return c.optionId === prerequisiteOptionIds[i];
																});
																if (c) {
																	optionId = c.optionId;
																	return false;
																}
															});
															if (optionId) return false;
														});
													}
													if (_.isInteger(optionId) && optionId > 0) {
														selected.push(optionId);
														return false;
													}
												});
											}
											if (selected.length && _.isObject(s.prerequisiteOptionGroups)) {
												_.each(s.prerequisiteOptionGroups, function (ids) {
													if (ids.length < 2) return;
													for (var n = 0; n < ids.length; n++) {
														var id = ids[n];
														if (selected.indexOf(id) >= 0) {
															selected = selected.concat(ids);
															break;
														}
													}
												});
												selected = _.uniq(selected).sort();
											}
											console.log("section(%s): prerequisite options: [%s]; matched: [%s]", s.id, prerequisiteOptionIds.join(","), selected.join(","));
											return selected.length === prerequisiteOptionIds.length;
										};
									}
									else {
										console.log("section(%s): no prerequisite options.", s.id);
										s.isRequired = _.stubTrue;
									}
								});

								if (model.sectionId) {
									model.section = _.find(model.survey.sections, function (it) {
										return it.id === model.sectionId;
									});
									if (model.survey && model.section) {
										var dbg = "survey(" + model.survey.id + "):";
										_.each([_.values(model.survey.sections), model.sections.selectable], function (collection) {
											dbg += " [";
											_.each(collection, function (s, n) {
												var first = n === 0;
												var current = (s.id === model.section.id);
												dbg += (first ? "" : " ") + (current ? "(" : "") + s.displayOrder + ":" + s.id + (current ? ")" : "")
											});
											dbg += "]";
										});
										console.log(dbg);
									}
								}
								if (!model.response.done && !model.section) {
									model.section = _.find(model.sections.selectable, _.identity);
									if (!model.section) {
										throw new Error("survey(" + model.surveyId + "): cannot select any default active section");
									}
									home.Router.go([path[0], path[1], path[2], model.section.id]);
									model.rerouted = true;
									//return;
								}
							}
						})
					])
				];
				if (!model.surveyId) {
					deferred.push(home.Image.Vector.fetchSVG(images));
				}

				Promise.all(deferred).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					home.View.warn = false;
					var template;
					if (model.survey && !model.section) {
						template = tpl.sections;
						home.View.documentTitle = model.survey.name;
					}
					else if (!model.survey) {
						template = tpl.surveyListCard;
						home.View.documentTitle = txt.navExpatSurveys;
					}
					else {
						template = tpl.surveys;
						if (model.survey && model.section) {
							home.View.documentTitle = model.survey.name + "-" + model.section.name;
						}
					}
					home.View.Pane.content[0].innerHTML = template(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						tpl: tpl,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					function clickSection(evt) {
						if (evt.target.tagName === "LI") {
							var href = $(evt.target).find('a').eq(0).attr("href");
							if (href.indexOf("#") === 0) {
								location.hash = href;
							}
						}
					}

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

					if (model.survey && model.section) {

						// mode: view or update survey response
						var restyled = RT.jQuery.restyleInputs($card);

						RT.jQuery.setupHoverClass($card.find('.footer a.accent-ghost'));
						RT.jQuery.selectOnFocus($card.find('input[type="text"], input[type="number"], textarea'));
						if (!model.locked) {
							RT.jQuery.trimOnBlur($card.find('input[type="text"]:not(.datefield):not(.intfield), textarea'));
						}

						var validate = function () {
							var result = {
								enable: {
									prev: _.isObject(model.sections.prev),
									next: true,
									last: true
								}
							};

							// todo: for repeating fields, check that each value is unique

							var $ul = $card.find('ul.questions');
							_.each(model.section.surveyQuestions, function (sq) {
								var q = model.survey.questions[sq.questionId];
								if (!q || !q.mandatory || q.archived || sq.archived) {
									return; // continue
								}

								if (q.type === "DateField" && _.isEmpty(q.selectableDaysOfWeek)) {
									return; // continue
								}

								if ((q.type === "Radio" || q.type === "Checkbox") && _.isEmpty(q.selectableOptions)) {
									return; // continue
								}

								var $li = $ul.find('li[data-id="' + sq.id + '"]');
								var $f;
								var valueCount = 0;
								switch (q.type) {
									case "TextField": {
										$f = $li.find('input' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
										$f.each(function () {
											if (this.value.trim().length) valueCount++;
										});
										break;
									}
									case "TextArea": {
										$f = $li.find('textarea' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
										$f.each(function () {
											if (this.value.trim().length) valueCount++;
										});
										break;
									}
									case "DateField": {
										$f = $li.find('input' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
										$f.each(function () {
											var $i = $(this);
											var dv = RT.jQuery.dateValue($i);
											if (dv) {
												var m = moment(dv);
												var iwd = m.isoWeekday();
												if (_.isArray(q.selectableDaysOfWeek) && q.selectableDaysOfWeek.indexOf(iwd) >= 0) {
													valueCount++;
												}
											}
										});
										break;
									}
									case "IntField": {
										$f = $li.find('input' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
										$f.each(function () {
											var $i = $(this);
											var iv = RT.jQuery.intValue($i);
											if (_.isInteger(iv) && (!_.isInteger(q.maxInt) || iv <= q.maxInt) && (!_.isInteger(q.minInt) || iv >= q.minInt)) {
												valueCount++;
											}
										});
										break;
									}
									case "Radio": {
										$f = $li.find('input[type="radio"][name="sq-' + sq.id + '"]');
										$f.each(function () {
											if (this.checked) {
												if (this.value === "other") {
													var $t = $li.find('input.other[type="text"][data-for="' + this.id + '"]');
													if ($t.val().trim().length && q.selectableOther) {
														valueCount++;
													}
												}
												else {
													valueCount++;
												}
												if (valueCount > 0) return false; // stop loop
											}
										});
										break;
									}
									case "Checkbox": {
										$f = $li.find('input[type="checkbox"][name="sq-' + sq.id + '"]');
										$f.each(function () {
											if (this.checked) {
												if (this.value === "other") {
													var $t = $li.find('input.other[type="text"][data-for="' + this.id + '"]');
													if ($t.val().trim().length && q.selectableOther) {
														valueCount++;
													}
												}
												else {
													valueCount++;
												}
											}
										});
										break;
									}
									default:
										throw new Error("question(" + sq.questionId + "): type: " + q.type);
								}
								if (!valueCount || (q.cardinality && valueCount < q.cardinality)) {
									return (result.enable.next = false); // break
								}
							});

							if (result.enable.next) {
								_.each(model.sections.selectable, function (s) {
									// skip old version of current section
									if (s.id === model.section.id) return;

									// skip optional sections
									if (!s.isRequired()) return;

									_.each(s.surveyQuestions, function (sq) {
										var q = model.survey.questions[sq.questionId];
										if (!q || !q.mandatory || q.archived || sq.archived) {
											return; // continue
										}
										if (q.type === "DateField" && _.isEmpty(q.selectableDaysOfWeek)) {
											return; // continue
										}
										if ((q.type === "Radio" || q.type === "Checkbox") && _.isEmpty(q.selectableOptions)) {
											return; // continue
										}

										var valueCount = 0;
										if (!_.isEmpty(sq.answers)) {
											switch (q.type) {
												case "TextArea":
												case "TextField": {
													_.each(sq.answers, function (a) {
														if (a.value) valueCount++;
													});
													break;
												}
												case "DateField": {
													_.each(sq.answers, function (a) {
														if (a.value && fmt.ISO8601.re.date.test(a.value)) {
															var m = moment(a.value);
															var iwd = m.isoWeekday();
															if (_.isArray(q.selectableDaysOfWeek) && q.selectableDaysOfWeek.indexOf(iwd) >= 0) {
																valueCount++;
															}
														}
													});
													break;
												}
												case "IntField": {
													_.each(sq.answers, function (a) {
														var iv = a.value ? parseInt(a.value, 10) : null;
														if (_.isInteger(iv) && (!_.isInteger(q.maxInt) || iv <= q.maxInt) && (!_.isInteger(q.minInt) || iv >= q.minInt)) {
															valueCount++;
														}
													});
													break;
												}
												case "Radio": {
													_.each(sq.answers, function (a) {
														if (!_.isEmpty(a.choices)) {
															valueCount++;
															return false; // stop loop, Radio requires only 1 choice
														}
													});
													break;
												}
												case "Checkbox": {
													_.each(sq.answers, function (a) {
														if (!_.isEmpty(a.choices)) {
															valueCount++;
														}
													});
													break;
												}
												default:
													throw new Error("question(" + sq.questionId + "): type: " + q.type);
											}
										}
										if (!valueCount || (q.cardinality && valueCount < q.cardinality)) {
											return (result.enable.last = false); // break
										}
									});
								});
								result.enable.next = _.isObject(model.sections.next);
							}
							else {
								result.enable.last = false;
							}

							return result;
						};

						var mediate = function () {
							var validity = validate();

							var $prev = $card.find('.footer a.nav.prev');
							var $next = $card.find('.footer a.nav.next');
							var $last = $card.find('.footer a.nav.last');
							RT.jQuery.withClassIf($prev, "disabled", !validity.enable.prev);
							RT.jQuery.withClassIf($next, "disabled", !validity.enable.next);
							RT.jQuery.withClassIf($last, "disabled", !validity.enable.last);
						};

						if (!model.locked) {
							// following code must also be applied to dynamically-added repeatable fields
							$card.find('.q-textfield input')
								.on('blur change', mediate);

							$card.find('.q-textarea textarea')
								.on('blur change', mediate);

							$card.find('.q-intfield input')
								.on('blur change', RT.jQuery.forceIntFormat)
								.on('blur change', mediate);

							$card.find('.q-datefield input')
								.on('blur change', RT.jQuery.forceDateFormat)
								.on('blur change', mediate);

							restyled.controls.on('change', mediate);

							var setupRepeatableFields = function () {
								var afterRepeatableFieldEdit = function (evt) {
									// note: must be idempotent, handles 2 events!
									var $in = $(this);
									var $li = $in.closest('li');
									var $peers = $li.find('[data-repeatable]');

									var q = model.survey.questions[$li.data("qid")];

									var empty = _.filter($peers, function (el) {
										return _.isEmpty(el.value);
									});

									var domId;

									if (empty.length > 1) {
										for (var i = 0; i < empty.length - 1; i++) {
											$(empty[i]).closest('div.q-field').remove();
										}
									}
									else if (!empty.length) {
										var $qf = $('<div>', {
											'class': 'q-field'
										}).appendTo($li);

										var $extra = null;

										switch (q.type) {
											case "TextField": {
												$extra = $('<input>', {
													'type': 'text',
													'autocomplete': 'off'
												}).appendTo($qf);
												RT.jQuery.trimOnBlur($extra);
												break;
											}
											case "TextArea": {
												$extra = $('<textarea>', {
													'rows': 4,
													'cols': 40
												}).appendTo($qf);
												RT.jQuery.trimOnBlur($extra);
												break;
											}
											case "DateField": {
												domId = _.uniqueId(q.type);
												$extra = $('<input>', {
													'type': 'text',
													'id': domId,
													'class': q.type.toLowerCase(),
													'maxlength': 10,
													'placeholder': txt.calendarDigitDateMask
												}).appendTo($qf)
													.on('blur change', RT.jQuery.forceDateFormat);
												// noinspection HtmlRequiredAltAttribute,RequiredAttributes
												$('<img>', {
													'class': 'datepicker-icon',
													'data-pick-date-for': domId,
													'data-pick-date-title': q.name,
													'src': home.Route.themeStyleUri + 'media/form1x/window_dialog.png',
													'srcset': home.Route.themeStyleUri + 'media/form1x/window_dialog.png 1x, ' + home.Route.themeStyleUri + 'media/form2x/window_dialog.png 2x',
												}).appendTo($qf)
													.on('click', clickDatePickerIcon);
												break;
											}
											case "IntField": {
												$extra = $('<input>', (function () {
													var attrs = {
														'type': 'number',
														'class': q.type.toLowerCase(),
														'step': 1
													};
													if (_.isInteger(q.minInt)) attrs.min = q.minInt;
													if (_.isInteger(q.maxInt)) attrs.max = q.maxInt;
													return attrs;
												})()).appendTo($qf)
													.on('blur change', RT.jQuery.forceIntFormat);
												break;
											}
										}

										if ($extra) {
											RT.jQuery.selectOnFocus($extra);
											$extra.attr('data-repeatable', '')
												.attr('data-repeat-ready', '')
												.on('blur change', afterRepeatableFieldEdit)
												.on('change', mediate)
												.focus();
										}
									}

									// renumber @data-i
									$peers = $li.find('[data-repeatable]');
									for (var p = 0; p < $peers.length; p++) {
										$peers.eq(p).attr("data-i", p);
									}
								};

								$card.find('[data-repeatable]:not([data-repeat-ready])')
									.on('blur change', afterRepeatableFieldEdit)
									.attr('data-repeat-ready', '');
							};
							setupRepeatableFields();

							function lookupDomOption(element) {
								var $t = $(element);
								var forOption = $t.data('for');
								var domOption = forOption ? document.getElementById(forOption) : null;
								return domOption && _.isElement(domOption) && "checked" in domOption ? domOption : null;
							}

							$card.find('input.other[data-for]')
								.on('blur change', function () {
									var domOption = lookupDomOption(this);
									if (domOption) {
										domOption.checked = !!this.value;
										restyled.repaint();
									}
								})
								.on('blur change', mediate)
								.each(function () {
									var domOption = lookupDomOption(this);
									if (domOption) {
										var $o = $(domOption);
										var $t = $(this);
										$o.click(function () {
											var v = $t.val().trim();
											if (domOption.checked === false) {
												if (v) {
													$t.data("backup", v);
													$t.val("");
												}
											}
											else if (domOption.checked === true) {
												var b = $t.data("backup");
												if (!v && b && _.isString(b)) {
													$t.val(b);
												}
												$t.select().focus();
											}
										});
									}
								});

							function clickDatePickerIcon() {
								var $icon = $(this);
								var $text = $('#' + $icon.data('pickDateFor'));
								var $li = $text.closest('li');

								var q = model.survey.questions[$li.data("qid")];

								datePicker.create($text, $icon, {
									title: $icon.data('pickDateTitle'),
									defaultNavigationMonth: function () {
										return RT.jQuery.dateValue($text);
									},
									navigable: function (m/*, offset*/) {
										var ty = MOMENT_TODAY.year();
										var ny = m.year();
										return ny >= ty - 80 && ny <= ty + 80;
									},
									selectable: function (m/*, mInitial*/) {
										var dow = m.isoWeekday();
										return q && _.isArray(q.selectableDaysOfWeek) && q.selectableDaysOfWeek.indexOf(dow) >= 0;
									}
								}).then(function (result) {
									if (moment.isMoment(result)) {
										//debugger;
									}
								}).catch(home.View.rejectHandler);
							}

							$card.find('img[data-pick-date-for]').on('click', clickDatePickerIcon);
						}

						if (model.sections.isNavigable()) {
							$card.find('.footer a.nav').click(function (evt) {
								RT.jQuery.cancelEvent(evt);

								var $a = $(this);
								var classes = {
									prev: $a.hasClass("prev"),
									next: $a.hasClass("next"),
									last: $a.hasClass("last")
								};
								var cancel = false;
								var validity;

								if ($a.hasClass("disabled")) {
									cancel = true;
								}
								else if (classes.prev || classes.next || classes.last) {
									// double-check: if mandatory other field emptied, then blurred by click on this button, disabled state won't have been applied in time
									validity = validate();
									_.each(["prev", "next", "last"], function (k) {
										if (classes[k] && !validity.enable[k]) cancel = true;
									});
								}

								var hp = $a.data("action") === "actionFinishLater"
									? "#" + path[0]
									: $a.attr("href");
								if (!cancel && (classes.prev || classes.next)) {
									var s = model.sections[classes.prev ? "prev" : "next"];
									if (_.isObject(s)) {
										if (hp.length > 2 && hp.indexOf("#") === 0) {
											hp = hp.substring(0, hp.lastIndexOf("/") + 1) + s.id;
										}
									}
								}

								if (cancel) {
									$a.addClass("disabled");
									return false;
								}
								else if (model.locked) {
									location.href = hp;
									return false;
								}

								if (home.User.expat && model.section) {
									var rs = {
										done: $a.data("action") === "actionIveFinished",
										surveyQuestions: {}
									};

									var $ul = $card.find('ul.questions');
									_.each(model.section.surveyQuestions, function (sq) {
										var q = model.survey.questions[sq.questionId];

										var sqr = [];
										var $li = $ul.find('li[data-id="' + sq.id + '"]');
										var $f;
										switch (q.type) {
											case "TextField": {
												$f = $li.find('input' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
												_.each($f, function (e) {
													var $e = $(e);
													var a = {
														a: $e.data('a'),
														value: e.value.trim()
													};
													if (!_.isInteger(a.a)) delete a.a; // not update
													if (!a.value) return;
													sqr.push(a);
												});
												break;
											}
											case "TextArea": {
												$f = $li.find('textarea' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
												_.each($f, function (e) {
													var $e = $(e);
													var a = {
														a: $e.data('a'),
														value: e.value.trim()
													};
													if (!_.isInteger(a.a)) delete a.a; // not update
													if (!a.value) return;
													sqr.push(a);
												});
												break;
											}
											case "DateField": {
												$f = $li.find('input' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
												_.each($f, function (e) {
													var $e = $(e);
													var a = {
														a: $e.data('a'),
														value: RT.jQuery.dateValue($e)
													};
													if (!_.isInteger(a.a)) delete a.a; // not update
													if (!a.value) return;

													var m = moment(a.value);
													var iwd = m.isoWeekday();
													if (!(_.isArray(q.selectableDaysOfWeek) && q.selectableDaysOfWeek.indexOf(iwd) >= 0)) {
														return;
													}
													sqr.push(a);
												});
												break;
											}
											case "IntField": {
												$f = $li.find('input' + (_.isInteger(q.cardinality) ? '[data-i]' : ''));
												_.each($f, function (e) {
													var $e = $(e);
													var a = {
														a: $e.data('a'),
														value: RT.jQuery.intValue($e)
													};
													if (!_.isInteger(a.a)) delete a.a; // not update
													if (!_.isInteger(a.value) || (_.isInteger(q.maxInt) && a.value > q.maxInt) || (_.isInteger(q.minInt) && a.value < q.minInt)) {
														return;
													}
													if (!a.value) return;
													sqr.push(a);
												});
												break;
											}
											case "Radio": {
												$f = $li.find('input[type="radio"][name="sq-' + sq.id + '"]');
												_.each($f, function (e) {
													if (!e.checked) return;
													var $e = $(e);
													var a = {
														a: $e.data('a'),
														option: e.value === "other" ? e.value : _.toInteger(e.value)
													};
													if (!_.isInteger(a.a)) delete a.a; // not update
													if (e.value === "other") {
														var $t = $li.find('input.other[type="text"][data-for="' + e.id + '"]');
														a.value = $t.val().trim();
														if (!a.value || !q.selectableOther) return;
													}
													sqr = a;
													return false; // break loop, Radio is single-choice
												});
												break;
											}
											case "Checkbox": {
												$f = $li.find('input[type="checkbox"][name="sq-' + sq.id + '"]');
												sqr = {
													a: null,
													options: [],
													other: null
												};
												_.each($f, function (e) {
													if (!e.checked) return;
													var $e = $(e);
													var answerId = $e.data('a');
													if (_.isInteger(answerId) && answerId > 0 && !sqr.a) {
														sqr.a = answerId;
													}
													if (e.value === "other") {
														var $t = $li.find('input.other[type="text"][data-for="' + e.id + '"]');
														var tv = $t.val().trim();
														if (tv && q.selectableOther) {
															sqr.other = tv;
															return; // continue
														}
													}
													var optionId = _.toInteger(e.value);
													if (_.isInteger(optionId) && optionId > 0) {
														sqr.options.push(optionId);
													}
												});
												if (!_.isInteger(sqr.a)) {
													delete sqr.a; // not update
												}
												if (_.isEmpty(sqr.options)) {
													delete sqr.options;
												}
												else if (sqr.options.length > 1) {
													sqr.options.sort();
												}
												if (_.isEmpty(sqr.other)) {
													delete sqr.other;
												}
												if (!sqr.other && _.isEmpty(sqr.options)) {
													sqr = null;
												}
												break;
											}
											default:
												throw new Error("question(" + sq.questionId + "): type: " + q.type);
										}
										if (!_.isEmpty(sqr)) rs.surveyQuestions[sq.id] = sqr;
									});

									RT.jQuery.put({
										url: home.Route.survey + home.User.id + "/" + model.survey.id + "/" + model.section.id,
										data: JSON.stringify(rs),
										contentType: "application/json",
										dataType: false
									}).then(function (rs) {
										return new Promise(function (resolve, reject) {
											if (rs.statusCode === 205) {
												console.log("survey(%s): response updated for section(%s)", model.survey.id, model.section.id);
												home.Badge.invalidate();
												location.hash = hp;
												resolve(hp);
											}
											else {
												console.warn("unexpected response update result: %O", rs);
												reject(new Error("HTTP " + rs.statusCode));
											}
										});
									}).catch(function (fault) {
										console.error("survey(%s): response update fault for section(%s)", model.survey.id, model.section.id, fault);
										home.View.warn = true;
									});
								}

								return false;
							});
						}

						mediate();
					}
					else if (model.survey) { // list sections
						RT.jQuery.setupHoverClass($card.find('ul.sections > li')).on('click', clickSection);

						$card.find('button.action.unlock').on('click', function () {
							$(this).prop('disabled', true);
							var rq = {
								done: false
							}
							RT.jQuery.put({
								url: home.Route.surveyState + home.User.id + "/" + model.survey.id,
								data: JSON.stringify(rq),
								contentType: "application/json",
								dataType: false
							}).then(function (rs) {
								return new Promise(function (resolve, reject) {
									if (rs.statusCode === 205 || rs.statusCode === 204) {
										console.log("survey(%s): set done := %s", model.survey.id, rq.done);
										home.Badge.invalidate();
										home.Router.update();
										resolve(rs.statusCode);
									}
									else {
										console.warn("unexpected response update result: %O", rs);
										reject(new Error("HTTP " + rs.statusCode));
									}
								});
							}).catch(function (fault) {
								console.error("survey(%s): response update fault.", model.survey.id, fault);
								home.View.warn = true;
							});

						});
					}
					else if (model.surveys) {
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
					}
				}).catch(home.View.rejectHandler);
			}
		};
	}
);