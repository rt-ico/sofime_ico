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
				// added on last step, so that URI is different to URI in navbar (prevent getting stuck here)
				if (path.length === 2 && path[1] === "done") {
					(function () {
						var $card = home.View.Pane.content.find('div.card').eq(0);
						if (!$card.length || !$card.hasClass("relo-setup")) {
							home.Router.go([path[0]]);
						}
					})();
					return;
				}

				home.Profile.require("HR");
				home.View.actions = null;

				var tpl = {
					card: "hrReloSetup"
				};
				var images = {
					info: "information.svg"
				};
				var model = {
					moment: {
						today: moment().startOf("day")
					},
					gender: null,
					callCode: null,
					country: null,
					familyRelation: null,
					service: null,
					serviceCategory: null,
					servicePacks: {},
					get sp1() {
						var c = dataChoices.client ? this.servicePacks.clients[dataChoices.client] : null;
						return c ? c.servicePacks[0] : null;
					},
					get sp2() {
						var c = dataChoices.client ? this.servicePacks.clients[dataChoices.client] : null;
						return c ? c.servicePacks[1] : null;
					},
					selectableServices: [],
					selectableCategories: [],
					reason: null,
					agencyPayer: null,
					leaseType: null,
					yesNo: [{
						value: 1,
						label: txt.yes
					}, {
						value: 0,
						label: txt.no
					}],
					get doPickClient() {
						return _.size(this.servicePacks.clients) > 1;
					},
					lookup: {
						mail: {
							validated: [],
							conflicting: []
						},
						done: _.noop
					},
					step: 1,
					creating: false,
					rerouted: false
				};
				var dataChoices = {
					client: null,
					telZone1: null,
					rentTerminationSender: null,
					features: {
						homeSearch: false,
						tempHomeSearch: false,
						departureHelp: false,
						intlSchool: false,
						mobilipass: false
					}
				};

				function validateMail(mail) {
					if (!mail || !fmt.Mail.match(mail = mail.toLowerCase())) return false;

					if (model.lookup.mail.validated.indexOf(mail) >= 0) {
						return true;
					}
					if (model.lookup.mail.conflicting.indexOf(mail) >= 0) {
						return false;
					}

					RT.jQuery.get({
						url: home.Route.expatLookup + "mail/" + encodeURIComponent(mail),
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						var matchId = rs.data.expat.match;
						if (_.isSafeInteger(matchId)) {
							model.lookup.mail.conflicting.push(mail);
							console.warn("Non-unique mail(%s): %s", matchId, mail);
							RT.Dialog.create({
								title: txt.expatriateMail,
								sheet: true,
								warn: true,
								width: 320,
								height: 260,
								content: function () {
									return '<p>' + fmt.nl2br(_.escape(fmt.sprintf(txt.reloSetupDuplicateMail, mail))) + '</p>';
								},
								dismiss: txt.actionClose
							});
						}
						else {
							model.lookup.mail.validated.push(mail);
						}

						model.lookup.done();
					}).catch(function (fault) {
						console.error("failed to validate: %s; %O", mail, fault);
					});

					return null;
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.gender = rs.data.gender;
							model.callCode = rs.data.callCode;
							model.country = rs.data.country;
							model.familyRelation = rs.data.familyRelation;
							model.serviceCategory = rs.data.serviceCategory;
							model.service = rs.data.service;
							model.reason = rs.data.reason;
							model.rentTerminationSender = rs.data.rentTerminationSender;
							model.agencyPayer = rs.data.agencyPayer;
							model.leaseType = rs.data.leaseType;

							_.each(model.service, function (s) {
								if (s.category) s.category = model.serviceCategory[s.category];
							});

							_.each(model.callCode, function (cc) {
								cc.getName = function () {
									return this.callPrefix + " － " + model.country[this.country].name;
								};
								cc.getName = cc.getName.bind(cc);
							});
						}),
						RT.jQuery.get({
							url: home.Route.servicePackData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.servicePacks.clients = rs.data.clients;
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					model.selectableServices = _.chain(model.service)
						.filter(function (s) {
							return _.isObject(s.category) && s.showPrestation;
						}).value().sort(function (a, b) {
							var x = a.category.id - b.category.id;
							if (x) {
								x = a.category.name < b.category.name ? -1 : a.category.name > b.category.name ? 1 : 0;
							}
							if (!x) x = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
							return x ? x : a.id - b.id;
						});
					_.each(model.selectableServices, function (s) {
						var sc = _.find(model.selectableCategories, function (sc) {
							return sc.id === s.category.id;
						});
						if (!sc) {
							sc = _.pick(s.category, ["id", "name", "localeName"]);
							sc.services = [];
							model.selectableCategories.push(sc);
						}
						sc.services.push(s);
					});

					if (_.isEmpty(model.selectableServices)) {
						throw new Error("no selectable services (note: service categories are required)");
					}

					if (!model.doPickClient) {
						if (_.isEmpty(model.servicePacks.clients)) {
							throw new Error("no delegate customers");
						}
						dataChoices.client = _.values(model.servicePacks.clients)[0].id;
					}

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						images: images,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					var controls = {
						restyled: RT.jQuery.restyleInputs($card),
						client: model.doPickClient ? home.jQuery.createTypeAhead($('#rs-client'), {
							name: 'client',
							identityKey: 'id',
							displayKey: 'name',
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(_.values(model.servicePacks.clients)),
							onSelect: function (v) {
								dataChoices.client = v ? v.id : null;
								servicesSelected(); // invokes mediate()
							}
						}) : null,
						sp1: $card.find('.sp1'),
						sp2: $card.find('.sp2'),
						services: $card.find('.service input[type="checkbox"]'),
						gender: $card.find('.pick-gender input[type="radio"]'),
						sn: $('#rs-sn'),
						gn: $('#rs-gn'),
						mail: $('#rs-mail'),
						tel1: $('#rs-tel1'),
						telZone1: home.jQuery.createTypeAhead($('#rs-telZone1'), {
							name: 'telZone1',
							identityKey: 'id',
							displayKey: 'getName',
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(_.values(model.callCode)),
							onSelect: function (v) {
								dataChoices.telZone1 = v ? v.id : null;
								mediate();
							}
						}),
						remarks: $('#rs-remarks'),
						reason: $card.find('input[name="s3-reason"]'),
						trialPeriod: $card.find('input[name="s3-trialPeriod"]'),
						leaseType: $card.find('input[name="s3-leaseType"]'),
						agencyPayer: $card.find('input[name="s3-agencyPayer"]'),
						arrivalSalary: $card.find('input[name="s3-arrivalSalary"]'),
						housingBudget: $('#s3-housingBudget'),
						housingCompanyBudget: $('#s3-housingCompanyBudget'),
						housingGrant: $('#s3-housingGrant'),
						housingTempBudget: $('#s3-housingTempBudget'),
						housingStart: $('#s3-housingStart'),
						housingEnd: $('#s3-housingEnd'),
						housingTempDuration: $('#s3-housingTempDuration'),
						inventoryDate: $('#s3-inventoryDate'),
						rentTerminationSender: $card.find('input[name="s3-rentTerminationSender"]'),
						leavingDtEstimate: $('#s3-leavingDtEstimate'),
						intlSchoolNumberOfChildren: $card.find('#s3-intlSchoolNumberOfChildren'),
						intlSchoolAnnualPerChildBudget: $card.find('#s3-intlSchoolAnnualPerChildBudget'),
						mobilipassInfo: $card.find('.mobilipass-requested'),
						actions: {
							prev: $card.find('a.nav[href="#prev"]'),
							next: $card.find('a.nav[href="#next"]')
						}
					};

					function radioIntValue($jq) {
						var v = $jq.filter(":checked").val();
						return v ? _.toInteger(v) : null;
					}

					$card.find('.services div.detail:not(.disabled)').on('click', function () {
						var $div = $(this);
						var offset = $div.offset();
						var bubbleWidth = 280;
						RT.Popup.create({
							width: bubbleWidth,
							height: 0,
							top: offset.top,
							left: Math.max(0, offset.left - bubbleWidth),
							popupClasses: ["bubble", "left"],
							content: $div.attr("title")
						});
					});

					var maybeShowHousingBudget = function () {
						var showBudget = false;
						var showCompanyBudget = false;
						var showGrant = false;
						if (model.step === 3) {
							if (dataChoices.features.homeSearch) {
								var leaseType = radioIntValue(controls.leaseType);
								if (_.isInteger(leaseType) && _.isObject(leaseType = model.leaseType[leaseType])) {
									showBudget = leaseType.indicateBudget;
									showCompanyBudget = leaseType.indicateCompanyBudget;
									showGrant = leaseType.indicateGrant;
								}
							}
						}

						RT.jQuery.withClassIf(controls.housingBudget.closest('div.budget-indication'), "masked", !showBudget);
						RT.jQuery.withClassIf(controls.housingCompanyBudget.closest('div.company-budget-indication'), "masked", !showCompanyBudget);
						RT.jQuery.withClassIf(controls.housingGrant.closest('div.grant-indication'), "masked", !showGrant);
					};

					var mediate = function () {
						var done = {
							step1: false,
							step2: false,
							step3: false,
							get canGoPrev() {
								return model.step > 1 && model.step <= 3;
							},
							get canGoNext() {
								if (model.step >= 1 || model.step <= 3) {
									return !!(this["step" + model.step]);
								}
								return model.step > 3;
							},
							get all() {
								return !!(this.step1 && this.step2 && this.step3);
							}
						}

						done.step1 = _.isInteger(dataChoices.client) && getSelectedServices().length > 0;

						if (done.step1) {
							var gender = radioIntValue(controls.gender);
							var sn = controls.sn.val().trim();
							var gn = controls.gn.val().trim();
							var mail = controls.mail.val().trim();
							done.step2 = !!(_.isInteger(gender) /*&& !!dataChoices.telZone1*/ && sn && gn && fmt.Mail.match(mail) && model.lookup.mail.validated.indexOf(mail) >= 0);
						}
						if (done.step2) {
							var features = _.reduce(_.keys(dataChoices.features), function (o, k) {
								if (dataChoices.features[k]) o[k] = false;
								return o;
							}, {});

							if (features.hasOwnProperty("homeSearch")) {
								/*
								var trialPeriod = radioIntValue(controls.trialPeriod);
								var reason = radioIntValue(controls.reason);
								var leaseType = radioIntValue(controls.leaseType);
								var agencyPayer = radioIntValue(controls.agencyPayer);
								features.homeSearch = _.isInteger(trialPeriod) && _.isInteger(reason) && _.isInteger(leaseType) && _.isInteger(agencyPayer);
								*/
								features.homeSearch = true; // not mandatory after all...
							}
							if (features.hasOwnProperty("tempHomeSearch")) {
								var dtHousing1 = RT.jQuery.dateValue(controls.housingStart);
								var dtHousing2 = RT.jQuery.dateValue(controls.housingEnd);
								features.tempHomeSearch = !(dtHousing1 && dtHousing2) || dtHousing1 <= dtHousing2;
							}

							// no validation for these features...
							_.each(["departureHelp", "intlSchool", "mobilipass"], function (k) {
								if (features.hasOwnProperty(k)) features[k] = true;
							});

							var selectedFeatureCount = _.size(features);
							var validatedFeatureCount = selectedFeatureCount ? _.reduce(features, function (sum, v) {
								return v ? ++sum : sum;
							}, 0) : 0;

							done.step3 = selectedFeatureCount === validatedFeatureCount;
						}

						RT.jQuery.withClassIf(controls.actions.prev, "disabled", !done.canGoPrev);
						RT.jQuery.withClassIf(controls.actions.next, "disabled", !done.canGoNext);
						RT.jQuery.withClassIf(controls.mobilipassInfo, "masked", !dataChoices.features.mobilipass);
					};
					model.lookup.done = mediate;

					var getSelectedServices = function () {
						return _.chain(controls.services.filter(":checked"))
							.map(function (it) {
								var prefix = "svc-";
								var id = _.toInteger(it.name.substring(prefix.length));
								return id > 0 ? model.service[id] : null;
							}).filter(_.identity).value();
					};
					var servicesSelected = function () {
						var pack = {
							sp1: model.sp1,
							sp2: model.sp2
						}
						RT.jQuery.withClassIf(controls.sp1, "transparent", !pack.sp1).text(pack.sp1 ? pack.sp1.name : " ");
						RT.jQuery.withClassIf(controls.sp2, "transparent", !pack.sp2).text(pack.sp2 ? pack.sp2.name : " ");

						var selectedServices = getSelectedServices();
						var applied = {
							sp1: [],
							sp2: []
						};
						var svcFeatures = _.reduce(_.keys(dataChoices.features), function (o, k) {
							o[k] = false;
							return o;
						}, {});
						for (var i = 0; i < selectedServices.length; i++) {
							var svc = selectedServices[i];
							_.each(_.keys(svcFeatures), function (k) {
								if (!svcFeatures[k] && svc[k]) svcFeatures[k] = true;
							});
							if (!!pack.sp1 && pack.sp1.services.indexOf(svc.id) >= 0) applied.sp1.push(svc.id);
							if (!!pack.sp2 && pack.sp2.services.indexOf(svc.id) >= 0) applied.sp2.push(svc.id);
						}
						_.each(_.keys(svcFeatures), function (k) {
							dataChoices.features[k] = svcFeatures[k];
						});
						for (var n = 1; n <= 2; n++) {
							var k = "sp" + n;
							if (applied[k].length > 1) {
								applied[k] = _.chain(applied[k]).uniq().orderBy(_.identity).value();
							}
							applied[k] = !!((pack[k] && pack[k].services.length) && _.isEqual(pack[k].services, applied[k]));

							var $sp = controls[k];
							var activeClass = $sp.data("activeClass");
							RT.jQuery.withClassIf($sp, activeClass, applied[k]);
						}

						mediate();
					};

					(function () {
						controls.services.on('click', servicesSelected);

						//$card.find('input.date').on('blur change', RT.jQuery.forceDateFormat);

						var $txt = $card.find('input[type="text"]:not(.combo), input[type="number"], input[type="email"], input[type="tel"], textarea');
						RT.jQuery.selectOnFocus($txt);
						RT.jQuery.trimOnBlur($txt);

						controls.arrivalSalary
							.add(controls.housingBudget)
							.add(controls.housingCompanyBudget)
							.add(controls.housingGrant)
							.add(controls.housingTempDuration)
							.add(controls.intlSchoolNumberOfChildren)
							.add(controls.intlSchoolAnnualPerChildBudget)
							.on('blur change', RT.jQuery.forceIntFormat);

						controls.leaseType.on('click', maybeShowHousingBudget);

						controls.housingStart
							.add(controls.housingEnd)
							.add(controls.inventoryDate)
							.on('blur change', RT.jQuery.forceDateFormat);

						controls.mail.on('input change', function () {
							this.value = home.Locale.normalize(this.value.trim()).toLowerCase();
						}).on('change', function () {
							validateMail(this.value);
						});
						controls.tel1.on('input change', function () {
							var v1 = this.value;
							var v2 = v1.replace(/[^0-9.+() ]/g, "");
							if (v1 !== v2) this.value = v2;
						});

						$txt.on('change', mediate);
						controls.gender
							.add(controls.reason)
							.add(controls.trialPeriod)
							.add(controls.leaseType)
							.add(controls.agencyPayer)
							.on('click', mediate);

						controls.sn.on('change', function () {
							var v1 = this.value;
							var v2 = fmt.Capitalize.all(v1);
							if (v1 !== v2) this.value = v2;
						});
						controls.gn.on('change', function () {
							var v1 = this.value;
							var v2 = fmt.Capitalize.start(v1);
							if (v1 !== v2) this.value = v2;
						});

						controls.sp1.add(controls.sp2).on('click', function () {
							var $el = $(this);
							if ($el.hasClass("transparent")) return;

							var sp = $el.hasClass("sp1") ? model.sp1 : $el.hasClass("sp2") ? model.sp2 : null;
							if (sp) {
								var prefix = "svc-";
								var included = [];
								var doReset = $el.hasClass("applied");
								if (doReset) {
									controls.services.each(function () {
										var id = _.toInteger(this.name.substring(prefix.length));
										if (sp.services.indexOf(id) >= 0) this.checked = false;
									});
								}
								else {
									controls.services.each(function () {
										var id = _.toInteger(this.name.substring(prefix.length));
										var member = (sp.services.indexOf(id) >= 0);
										if (member) included.push(id);
										this.checked = member;
									});
								}
								controls.restyled.repaint();
								servicesSelected();

								if (!doReset && included.length < sp.services.length) {
									console.warn("Cannot apply all services in pack: %O", _.difference(sp.services, included));
									RT.Dialog.create({
										title: $el.text(),
										sheet: true,
										warn: true,
										width: 320,
										height: 260,
										content: function () {
											return '<p>' + fmt.nl2br(_.escape(txt.reloSetupInvalidPack)) + '</p>';
										},
										dismiss: txt.actionClose
									});
								}
							}
							else {
								console.warn("Cannot apply service pack: %s", $el.text());
							}
						});

						function popupInventoryDatePicker() {
							var $icon = $(this);
							var $text = $('#' + $icon.data('pickDateFor'));
							if ($text.length !== 1) return;

							var mDateLimit = model.moment.today;

							datePicker.create($text, $icon, {
								title: $icon.data('pickDateTitle'),
								defaultNavigationMonth: function () {
									var dnm = RT.jQuery.dateValue($text);
									if (dnm) {
										dnm = cachedMoment(dnm);
									}
									else {
										dnm = mDateLimit;
									}
									return dnm;
								},
								navigable: function (m/*, offset*/) {
									return m.isSameOrAfter(mDateLimit, 'day');
								},
								selectable: function (m/*, mInitial*/) {
									return m.isSameOrAfter(mDateLimit, 'day');
								}
							}).then(function (result) {
								// if (moment.isMoment(result)) { debugger; }
								mediate();
							}).catch(home.View.rejectHandler);
						}

						function popupTempHousingDatePicker() {
							var $icon = $(this);
							var id = $icon.data('pickDateFor');
							var $text = $('#' + id);
							if ($text.length !== 1) return;

							var isStart = id === "s3-housingStart";
							var $opposite = $('#s3-housing' + (isStart ? 'End' : 'Start'));

							var mDateLimit = model.moment.today;
							if (!isStart) {
								var mStartDate = RT.jQuery.dateValue($opposite);
								if (mStartDate) {
									mStartDate = cachedMoment(mStartDate);
									if (mStartDate.isValid()) {
										mDateLimit = mStartDate;
									}
								}
							}

							datePicker.create($text, $icon, {
								title: $icon.data('pickDateTitle'),
								defaultNavigationMonth: function () {
									var dnm = RT.jQuery.dateValue($text);
									if (dnm) {
										dnm = cachedMoment(dnm);
									}
									else {
										dnm = mDateLimit;
									}
									return dnm;
								},
								navigable: function (m/*, offset*/) {
									return m.isSameOrAfter(mDateLimit, 'day');
								},
								selectable: function (m/*, mInitial*/) {
									return m.isSameOrAfter(mDateLimit, 'day');
								}
							}).then(function (result) {
								// if (moment.isMoment(result)) { debugger; }
								mediate();
							}).catch(home.View.rejectHandler);
						}

						$card.find('img.datepicker-icon.departure-help').on('click', popupInventoryDatePicker);
						$card.find('img.datepicker-icon.temp-housing').on('click', popupTempHousingDatePicker);
					})();

					var showCurrentStep = function () {
						var $steps = [];
						for (var i = 1; i <= 4; i++) {
							var $s = $card.find('div.setup-' + i).eq(0);
							if ($s.length === 1) {
								$s.data("step", i);
								$steps.push($s);
								if (model.step !== i && !$s.hasClass("masked")) {
									$s.addClass("masked");
								}
								if (i === 3) {
									var $cond = $s.find('.conditional');
									$cond.addClass('masked');
									_.each(_.keys(dataChoices.features), function (k) {
										if (dataChoices.features[k]) {
											$cond.filter(function () {
												return $(this).hasClass("mode-" + k);
											}).removeClass("masked");
										}
									});

									var hasFeature = !!_.find(_.values(dataChoices.features), _.identity);
									var $void = $cond.filter(function () {
										return $(this).hasClass("mode-void")
									});
									RT.jQuery.withClassIf($void, "masked", hasFeature);
								}
							}
							if (model.step === 3) {
								maybeShowHousingBudget();
							}
							if (model.step === 4 && !model.creating) {
								// modify URI without re-rendering, this re-enables navbar link
								home.Router.go([path[0], "done"]);
							}
						}
						_.each($steps, function ($s) {
							if (model.step === $s.data("step") && $s.hasClass("masked")) {
								if (!model.creating) {
									$s.removeClass("masked");
								}
								mediate(); // refresh action button states if changing view
							}
						});
					};
					controls.actions.prev.on('click', function (evt) {
						var $a = $(this);
						if (!$a.hasClass("disabled") && model.step > 1) {
							model.step--;
							showCurrentStep();
						}
						return RT.jQuery.cancelEvent(evt);
					});
					controls.actions.next.on('click', function (evt) {
						var $a = $(this);
						if (!$a.hasClass("disabled") && model.step < 4) {
							if (model.step === 3) {
								model.creating = true;

								controls.actions.prev.addClass("disabled");
								controls.actions.next.addClass("disabled");

								var rq = {
									client: dataChoices.client,
									services: _.map(getSelectedServices(), function (s) {
										return s.id;
									}),
									gender: radioIntValue(controls.gender),
									sn: controls.sn.val().trim(),
									gn: controls.gn.val().trim(),
									mail: controls.mail.val().trim(),
									telZone1: dataChoices.telZone1,
									tel1: controls.tel1.val().trim(),
									remarks: controls.remarks.val().trim()
								};
								if (!rq.tel1) {
									delete rq.tel1;
									delete rq.telZone1;
								}
								if (dataChoices.features.homeSearch) {
									rq.reason = radioIntValue(controls.reason);
									rq.trialPeriod = radioIntValue(controls.trialPeriod) === 1;
									rq.leaseType = radioIntValue(controls.leaseType);
									rq.agencyPayer = radioIntValue(controls.agencyPayer);
									rq.arrivalSalary = RT.jQuery.intValue(controls.arrivalSalary);

									var leaseType = rq.leaseType ? model.leaseType[rq.leaseType] : null;
									if (leaseType) {
										if (leaseType.indicateBudget) {
											rq.housingBudget = RT.jQuery.intValue(controls.housingBudget);
										}
										if (leaseType.indicateCompanyBudget) {
											rq.housingCompanyBudget = RT.jQuery.intValue(controls.housingCompanyBudget);
										}
										if (leaseType.indicateGrant) {
											rq.housingGrant = RT.jQuery.intValue(controls.housingGrant);
										}
									}
								}
								if (dataChoices.features.tempHomeSearch) {
									rq.housingTempBudget = RT.jQuery.intValue(controls.housingTempBudget);
									rq.housingTempDuration = RT.jQuery.intValue(controls.housingTempDuration);

									// obsolete, kept here (just in case...)
									rq.housingStart = RT.jQuery.dateValue(controls.housingStart) || null;
									rq.housingEnd = RT.jQuery.dateValue(controls.housingEnd) || null;
								}
								if (dataChoices.features.departureHelp) {
									rq.inventoryDate = RT.jQuery.dateValue(controls.inventoryDate);
									rq.rentTerminationSender = radioIntValue(controls.rentTerminationSender);
									rq.leavingDtEstimate = controls.leavingDtEstimate.val().trim() || null;
								}
								if (dataChoices.features.intlSchool) {
									rq.intlSchoolNumberOfChildren = RT.jQuery.intValue(controls.intlSchoolNumberOfChildren);
									rq.intlSchoolAnnualPerChildBudget = RT.jQuery.intValue(controls.intlSchoolAnnualPerChildBudget);
								}

								console.log("Creating relocation: %O", rq);
								RT.jQuery.post({
									url: home.Route.reloSetup,
									data: JSON.stringify(rq),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									if (rs.statusCode !== 205) {
										throw new Error("unexpected status: " + rs.statusCode);
									}
									model.creating = false;
									showCurrentStep();
								}).catch(home.View.rejectHandler);
							}
							model.step++;
							showCurrentStep();
						}
						return RT.jQuery.cancelEvent(evt);
					});

					if (!model.doPickClient) {
						servicesSelected(); // for single-customer staff, enable service pack buttons
					}
				}).catch(home.View.rejectHandler);
			}
		};
	}
);