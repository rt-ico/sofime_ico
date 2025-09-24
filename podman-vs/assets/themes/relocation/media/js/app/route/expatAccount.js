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
		var MOMENT_UPPER = MOMENT_TODAY.clone().add(9, 'month');
		var MOMENT_FLOOR = MOMENT_TODAY.clone().subtract(16, 'year');
		var MOMENT_AS_OF = moment('2019-01-01').startOf('day');

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				if (!home.User.expat) {
					throw new Error("forbidden");
				}

				//home.View.title = txt.navMyAccount;
				home.View.actions = null;

				var tpl = {
					account: "expatAccount",
					familyMember: "expatFamilyMember"
				};
				var images = {
					add: "ux-add.svg",
					remove: "ux-trash.svg"
				};
				var model = {
					expat: null,
					gender: null,
					country: null,
					callCode: null,
					familyRelation: null,
					removedFamilyMemberIds: [],
					rerouted: false
				};
				var dataChoices = {
					telZone1: null,
					telZone2: null,
					birthCountry: null
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.expat + home.User.id,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.expat = rs.data.expat;
							if (_.isInteger(model.expat.birthCountry)) {
								dataChoices.birthCountry = model.expat.birthCountry;
							}
							if (_.isInteger(model.expat.telZone1)) {
								dataChoices.telZone1 = model.expat.telZone1;
							}
							if (_.isInteger(model.expat.telZone2)) {
								dataChoices.telZone2 = model.expat.telZone2;
							}
						}),
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.gender = rs.data.gender;
							model.country = rs.data.country;
							model.callCode = rs.data.callCode;
							model.familyRelation = rs.data.familyRelation;

							_.each(model.callCode, function (cc) {
								cc.getName = function () {
									return this.callPrefix + " － " + model.country[this.country].name;
								};
								cc.getName = cc.getName.bind(cc);
							});
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}

					function defineFamilyMemberTemplateData(fm) {
						return _.assign({
							route: home.Route,
							cachedMoment: cachedMoment,
							images: images,
							txt: txt,
							fmt: fmt,
							familyRelation: model.familyRelation,
							familyMember: fm
						}, model);
					}

					function removeFamilyMember(evt) {
						var $fm = $(this).closest('.family-member');
						var fm = toFamilyMember($fm);
						if (fm) {
							RT.Dialog.create({
								title: txt.yourFamily,
								sheet: true,
								width: 320,
								height: 240,
								actions: [{
									id: "confirm-remove",
									label: txt.actionDelete,
									classNames: ["warn"]
								}],
								dismiss: txt.actionCancel,
								content: function () {
									var escPrompt = _.escape(fm.gn.trim() ? fmt.sprintf(txt.promptRemoveNamedFamilyRelation, fm.gn) : txt.promptRemoveFamilyRelation);
									return '<p>' + escPrompt + '</p>';
								}
							}).then(function (result) {
								if (result === "confirm-remove") {
									if (fm.id) {
										model.removedFamilyMemberIds.push(fm.id);
									}
									$fm.remove()

									mediate();
								}
							}).catch(function (fault) {
								console.error("account creation fault", fault);
								home.View.warn = true;
							});
						}

						return RT.jQuery.cancelEvent(evt);
					}

					home.View.warn = false;
					home.View.Pane.content[0].innerHTML = tpl.account(_.assign({
						user: home.User,
						route: home.Route,
						cachedMoment: cachedMoment,
						defineFamilyMemberTemplateData: defineFamilyMemberTemplateData,
						images: images,
						tpl: tpl,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
                    var $gdprDeleteRequest = $card.find('.footer a.gdpr-delete-request').eq(0);
                    var $update = $card.find('.footer a.update').eq(0);

					var controls = {
						restyled: RT.jQuery.restyleInputs($card),
						gender: $card.find('input[name="gender"]'),
						sn: $card.find('input[name="sn"]'),
						gn: $card.find('input[name="gn"]'),
						arrivalDate: $card.find('input[name="arrivalDate"]'),
						birthDate: $card.find('input[name="birthDate"]'),
						birthPlace: $card.find('input[name="birthPlace"]'),
						homeMail: $card.find('input[name="homeMail"]'),
						workMail: $card.find('input[name="workMail"]'),
						oldAddress: $card.find('textarea[name="oldAddress"]'),
						newJobAddress: $card.find('input[name="newJobAddress"]'),
						newJobCity: $card.find('input[name="newJobCity"]'),
						newJobPostCode: $card.find('input[name="newJobPostCode"]'),
						tel1: $card.find('input[name="tel1"]'),
						tel2: $card.find('input[name="tel2"]'),
						telZone1: home.jQuery.createTypeAhead($card.find('input[type="text"][name="telZone1"]'), {
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
						telZone2: home.jQuery.createTypeAhead($card.find('input[type="text"][name="telZone2"]'), {
							name: 'telZone2',
							identityKey: 'id',
							displayKey: 'getName',
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(_.values(model.callCode)),
							onSelect: function (v) {
								dataChoices.telZone2 = v ? v.id : null;
								mediate();
							}
						}),
						countries: home.jQuery.createTypeAhead($card.find('input[type="text"][name="birthCountry"]'), {
							name: 'birthCountry',
							identityKey: 'id',
							displayKey: 'name',
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(_.values(model.country)),
							onSelect: function (v) {
								dataChoices.birthCountry = v ? v.id : null;
								mediate();
							}
						}),
						addFamilyMember: RT.jQuery.setupHoverClass($card.find('.family-members > a.add'))
					};
					RT.jQuery.setupHoverClass($card.find('.family-members a.remove')).on('click', removeFamilyMember);

					if (model.expat.birthCountry) {
						home.jQuery.setTypeAheadValue(controls.countries, model.country[model.expat.birthCountry]);
					}
					if (model.expat.telZone1) {
						home.jQuery.setTypeAheadValue(controls.telZone1, model.callCode[model.expat.telZone1]);
					}
					if (model.expat.telZone2) {
						home.jQuery.setTypeAheadValue(controls.telZone2, model.callCode[model.expat.telZone2]);
					}
					RT.jQuery.trimOnBlur(controls.sn.add(controls.gn)
						.add(controls.workMail)
						.add(controls.telMain)
					);

					var mediate = function () {
						var canSubmit = _.toInteger(controls.gender.filter(':checked').val()) > 0;

						if (canSubmit) {
							canSubmit = !!(controls.sn.val() && controls.gn.val());
						}
						if (canSubmit) {
							var birthDate = RT.jQuery.dateValue(controls.birthDate);
							if (birthDate) {
								birthDate = cachedMoment(birthDate);
							}
							canSubmit = !!(birthDate && birthDate.isSameOrBefore(MOMENT_FLOOR, 'day'));
						}
						if (canSubmit) {
							canSubmit = _.isInteger(dataChoices.birthCountry);
						}
						if (canSubmit) {
							canSubmit = _.isInteger(dataChoices.telZone1);
						}
						if (canSubmit) {
							canSubmit = !!(controls.tel1.val());
						}
						if (canSubmit) {
							var mre = /^[^@]+@[^@]+$/;
							var validated = {};

							_.each(["homeMail", "workMail"], function (k) {
								validated[k] = false;
								var $f = controls[k];
								var v = $f.val();
								if (v) {
									if (mre.test(v)) {
										validated[k] = true;
									}
									else {
										$f.val("");
									}
								}
							});
							//canSubmit = _.chain(validated).values().filter(_.identity).value().length > 0;
							canSubmit = !!validated.workMail;
						}

						if (canSubmit) {
							canSubmit = !!(
								controls.oldAddress.val() &&
								controls.newJobAddress.val() &&
								controls.newJobCity.val() &&
								controls.newJobPostCode.val()
							);
						}

						if (canSubmit) {
							var fmCount = 0;
							var fmArray = [];
							$card.find('.family-member').each(function () {
								fmCount++;
								var fm = toFamilyMember($(this));
								if (isValidFamilyMember(fm)) {
									fmArray.push(fm);
								}
							});
							if (fmCount > fmArray.length) canSubmit = false;
						}

						RT.jQuery.withClassIf($update, "disabled", !canSubmit);
					};

					(function () {
						$card.find('input.date').on('blur change', RT.jQuery.forceDateFormat);
						controls.newJobPostCode.on('blur input change', RT.jQuery.forceIntFormat);

						var $txt = $card.find('input[type="text"]:not(.combo), input[type="email"], input[type="tel"], textarea');
						RT.jQuery.selectOnFocus($txt.add(controls.countries.selector));
						RT.jQuery.trimOnBlur($txt);

						controls.homeMail.add(controls.workMail).on('input change', function () {
							this.value = this.value.toLowerCase();
						});
						controls.tel1.add(controls.tel2).on('input change', function () {
							var v1 = this.value;
							var v2 = v1.replace(/[^0-9.+() ]/g, "");
							if (v1 !== v2) this.value = v2;
						});

						$txt.on('change', mediate);
						controls.gender.on('click', mediate);

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

						controls.addFamilyMember.on('click', function (evt) {
							var fragment = tpl.familyMember(defineFamilyMemberTemplateData(null));
							var inserted = $(fragment).insertBefore($(this));

							RT.jQuery.restyleInputs(inserted);
							RT.jQuery.setupHoverClass(inserted.find('a.remove')).on('click', removeFamilyMember);
							inserted.find('img.pick-birth-date').on('click', popupBirthDatePicker);
							inserted.find('input.date').on('blur change', RT.jQuery.forceDateFormat);

							var $txt = inserted.find('input[type="text"]')
								.on('input change', mediate);
							RT.jQuery.selectOnFocus($txt);
							RT.jQuery.trimOnBlur($txt);

							var $select = inserted.find('select')
								.on('change', mediate);
							setTimeout(function () {
								$select.eq(0).focus();
							}, 20);

							$update.addClass("disabled");
							return RT.jQuery.cancelEvent(evt);
						});
					})();

					function popupBirthDatePicker() {
						var $icon = $(this);
						var $text = $('#' + $icon.data('pickDateFor'));
						var floor = !!_.toInteger($text.data('floor'));
						var mDateLimit = floor ? MOMENT_FLOOR : MOMENT_UPPER;

						datePicker.create($text, $icon, {
							title: $icon.data('pickDateTitle'),
							defaultNavigationMonth: function () {
								var dnm = RT.jQuery.dateValue($text);
								if (dnm) {
									dnm = cachedMoment(dnm);
								}
								else {
									dnm = floor ? MOMENT_FLOOR : MOMENT_TODAY;
								}
								return dnm;
							},
							navigable: function (m/*, offset*/) {
								return m.isSameOrBefore(mDateLimit, 'day');
							},
							selectable: function (m/*, mInitial*/) {
								return m.isSameOrBefore(mDateLimit, 'day');
							}
						}).then(function (result) {
							// if (moment.isMoment(result)) { debugger; }
							mediate();
						}).catch(home.View.rejectHandler);
					}

					function popupArrivalDatePicker() {
						var $icon = $(this);
						var $text = $('#' + $icon.data('pickDateFor'));

						datePicker.create($text, $icon, {
							title: $icon.data('pickDateTitle'),
							defaultNavigationMonth: function () {
								var dnm = RT.jQuery.dateValue($text);
								if (dnm) {
									dnm = cachedMoment(dnm);
								}
								else {
									dnm = MOMENT_TODAY;
								}
								return dnm;
							},
							navigable: function (m/*, offset*/) {
								return m.isSameOrAfter(MOMENT_AS_OF, 'day');
							},
							selectable: function (m/*, mInitial*/) {
								return m.isSameOrAfter(MOMENT_AS_OF, 'day');
							}
						}).then(function (result) {
							// if (moment.isMoment(result)) { debugger; }
						}).catch(home.View.rejectHandler);
					}

					$card.find('img.pick-birth-date').on('click', popupBirthDatePicker);
					$card.find('img.pick-arrival-date').on('click', popupArrivalDatePicker);

					function toFamilyMember($fm) {
						var fm = {
							id: $fm.data("id"),
							familyRelation: RT.jQuery.intValue($fm.find('.familyRelation select').eq(0)),
							sn: $fm.find('.surName input').eq(0).val().trim(),
							gn: $fm.find('.givenName input').eq(0).val().trim(),
							birthDate: RT.jQuery.dateValue($fm.find('.birthDate input').eq(0)),
							remarks: $fm.find('.remarks input').eq(0).val().trim(),
							workingInFrance: $fm.find('.workingInFrance input').eq(0).is(":checked")
						};
						if (!_.isSafeInteger(fm.id) || fm.id < 1) {
							delete fm.id;
						}
						if (!fm.remarks) {
							delete fm.remarks;
						}
						return fm;
					}

					function isValidFamilyMember(fm) {
						return _.isSafeInteger(fm.familyRelation) && fm.familyRelation > 0 && !!fm.sn && !!fm.gn && !!fm.birthDate;
					}

					$update.on('click', function (evt) {
						if (!$update.hasClass("disabled")) {
							function telValue($jq) {
								var v = $jq.val();
								return v && _.isString(v) ? v.replace(/[^0-9.+() ]/g, "") : null;
							}

							function postCodeValue($jq) {
								var v = $jq.val();
								return v && _.isString(v) ? v.replace(/[^0-9]/g, "") : null;
							}

							var rq = {
								gender: _.toInteger(controls.gender.filter(':checked').val()),
								sn: controls.sn.val(),
								gn: controls.gn.val(),
								homeMail: controls.homeMail.val(),
								workMail: controls.workMail.val(),
								oldAddress: controls.oldAddress.val(),
								jobAddress: controls.newJobAddress.val(),
								jobCity: controls.newJobCity.val(),
								jobPostCode: postCodeValue(controls.newJobPostCode),
								telZone1: dataChoices.telZone1,
								tel1: telValue(controls.tel1),
								telZone2: dataChoices.telZone2,
								tel2: telValue(controls.tel2),
								arrivalDate: RT.jQuery.dateValue(controls.arrivalDate),
								birthDate: RT.jQuery.dateValue(controls.birthDate),
								birthPlace: controls.birthPlace.val(),
								birthCountry: dataChoices.birthCountry,
								familyMembers: [],
								removedFamilyMemberIds: model.removedFamilyMemberIds
							};

							$card.find('.family-member').each(function () {
								var $fm = $(this);
								var fm = toFamilyMember($fm);
								if (isValidFamilyMember(fm)) {
									rq.familyMembers.push(fm);
								}
							});
							//console.log("expat(%s): updating: %O", home.User.id, rq);

							RT.jQuery.put({
								url: home.Route.accountExpat,
								data: JSON.stringify(rq),
								contentType: "application/json",
								dataType: false
							}).then(function (rs) {
								return new Promise(function (resolve, reject) {
									if (rs.statusCode === 205) {
										console.log("account updated");
										location.reload();
										resolve("reload");
									}
									else {
										console.warn("unexpected response update result: %O", rs);
										reject(new Error("HTTP " + rs.statusCode));
									}
								});
							}).catch(function (fault) {
								console.error("account update fault", fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});

					$gdprDeleteRequest.on('click', function (evt) {
						if (!$gdprDeleteRequest.hasClass("disabled")) {

							RT.jQuery.delete({
								url: home.Route.accountExpat,
								dataType: false
							}).then(function (rs) {
								return new Promise(function (resolve, reject) {
									if (rs.statusCode === 202) {
										console.log("gdpr request sent");
										location.reload();
										resolve("reload");
									}
									else {
										console.warn("unexpected response update result: %O", rs);
										reject(new Error("HTTP " + rs.statusCode));
									}
								});
							}).catch(function (fault) {
								console.error("account update fault", fault);
								home.View.warn = true;
							});
						}
						return RT.jQuery.cancelEvent(evt);
					});

					mediate();
				}).catch(home.View.rejectHandler);
			}
		};
	}
);