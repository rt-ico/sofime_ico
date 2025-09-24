define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'app/datePicker'],
    function (home, RT, $, _, moment,datePicker) {
        "use strict";

        let ctx = null;
        let jst = null;
        let txt = RT.Text;
        let fmt = RT.Format;

        let cachedMoment = RT.Time.createMomentCache();
        let MOMENT_TODAY = moment().startOf('day');
        let MOMENT_UPPER = MOMENT_TODAY.clone().add(36, 'month');
        let MOMENT_FLOOR = MOMENT_TODAY.clone().subtract(16, 'year');

        function findById(id, collection) {
            var v = null;
            if (_.isInteger(id)) {
                v = _.find(collection, function (it) {
                    return id === it.id;
                });
            }
            return _.isObject(v) ? v : null;
        }

        function sortLocalized(a, b) {
            var x = home.Locale.compare(a.localeName || a.name, b.localeName || b.name);
            return x === 0 ? a.id - b.id : x;
        }

        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },
            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                home.View.actions = null;
                home.Profile.requireSofime();

                var tpl = {
                    card: "sfExpatHomeSearch"
                };
                var model = {
                    expatId: _.toInteger(path[1]),
                    expat: null,
                    backPath: path[2],
                    get locked() {
                        return home.User.profile !== "SF";
                    },
                    fields: null,
                    agencyPayer: null,
                    rentMode: null,
                    badPath: false,
                    rerouted: false
                };

                if (!_.isSafeInteger(model.expatId) || model.expatId <= 0) {
                    console.warn("Invalid URI parameter (expatId).");
                    model.badPath = true;
                }
                if (model.backPath && !model.badPath) {
                    if (model.backPath === "gm") {
                        model.backPath = "#sfMailSendGrouped/-/" + model.expatId;
                    }
                    else {
                        console.warn("Invalid URI parameter (backPath).");
                        model.badPath = true;
                    }
                }
                if (model.badPath) {
                    home.View.warn = true;
                    home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
                    return;
                }
                delete model.badPath;

                var dataChoices = {
                    agencyPaidBy: null,
                    rentMode: null
                };

                Promise.all([
                    jst.fetchTemplates(tpl),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.masterData,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            function bindGetName(o) {
                                o.getName = function () {
                                    return this.localeName || this.name;
                                };
                                o.getName = o.getName.bind(o);
                            }

                            model.agencyPayer = _.chain(_.values(rs.data.agencyPayer))
                                .each(bindGetName)
                                .value().sort(sortLocalized);
                            model.rentMode = _.chain(_.values(rs.data.rentMode))
                                .each(bindGetName)
                                .value().sort(sortLocalized);
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfExpatHomeSearch + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.fields = rs.data.fields;
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfExpat + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.expat = result.data.expat;
                            _.each(model.expat.services, function(it){
                                if(it.isTempHousing){
                                    model.tempHousingActivated = true;
                                }
                            })
                            if (!_.isObject(model.expat) || !model.expat.id || !model.expat.cn) {
                                throw new Error("expat(" + model.expatId + "): unexpected response");
                            }
                            if (model.expat.client) {
                                if (model.backPath && model.backPath.indexOf("#sfMailSendGrouped/") === 0) {
                                    model.backPath = model.backPath.replace(/\/-\//, "/" + model.expat.client.id + "/");
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

                    var flagGroup = [
                        ["flagFurniture", "flagNofurniture"],
                        ["flagParisCenter", "flagParisNorth", "flagParisSouth", "flagParisWest", "flagParisEast"],
                        ["flagSuburbWest", "flagNeuillyBoulogne", "flagOtherSuburbs"]
                    ];

                    home.View.documentTitle = model.expat.cn + " | " + txt.sfExpatHomeSearch;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        flagGroup: flagGroup,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    let $card = home.View.Pane.content.find('div.card').eq(0);

                    let controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        rentMode: $card.find('#sfhs_rentmode').eq(0),
                        agencyPaidBy: $card.find('#sfhs_agencypaidby').eq(0),
                        yearlyIncome: $card.find('#sfhs_yearlyincome'),
                        trialPeriod: $card.find('#sfhs_trialperiod'),
                        budget: $card.find('#sfhs_budget'),
                        companyBudget: $card.find('#sfhs_companybudget'),
                        grant: $card.find('#sfhs_grant'),
                        remarks: $card.find('#sfhs_remarks'),
                        sfhs_VisitDate: $card.find('input[name="sfhs_VisitDate"]'),
                    };
                    if(model.tempHousingActivated){
                        controls.dateEndOfTemporaryHome = $card.find('input[name="dateEndOfTemporaryHome"]');
                        controls.temporaryHomeBudget = $card.find('#temporaryHomeBudget');
                        controls.temporaryHomeDuration = $card.find('#temporaryHomeDuration');
                        controls.temporaryHomeExpenses = $card.find('#temporaryHomeExpenses');
                    }

                    if (!model.locked) {
                        controls.rentMode = home.jQuery.createTypeAhead(controls.rentMode, {
                            name: "rentMode",
                            identityKey: "id",
                            displayKey: "getName",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.rentMode),
                            onSelect: function (v) {
                                if (v && v.id) {
                                    dataChoices.rentMode = v.id;
                                }
                                else {
                                    dataChoices.rentMode = null;
                                }
                            }
                        });
                        controls.agencyPaidBy = home.jQuery.createTypeAhead(controls.agencyPaidBy, {
                            name: "agencyPaidBy",
                            identityKey: "id",
                            displayKey: "getName",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.agencyPayer),
                            onSelect: function (v) {
                                if (v && v.id) {
                                    dataChoices.agencyPaidBy = v.id;
                                }
                                else {
                                    dataChoices.agencyPaidBy = null;
                                }
                            }
                        });
                    }

                    function popupDatePicker() {
                        let $icon = $(this);
                        let $text = $('#' + $icon.data('pickDateFor'));
                        let floor = !!_.toInteger($text.data('floor'));
                        let mDateLimit = floor ? MOMENT_FLOOR : MOMENT_UPPER;

                        datePicker.create($text, $icon, {
                            title: $icon.data('pickDateTitle'),
                            defaultNavigationMonth: function () {
                                let dnm = RT.jQuery.dateValue($text);
                                if (dnm) {
                                    dnm = cachedMoment(dnm);
                                } else {
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
                        }).catch(home.View.rejectHandler);
                    }

                    $card.find('img.pick-birth-date').on('click', popupDatePicker);

                    //add flag
                    _.each(flagGroup, function (group) {
                        _.each(group, function (field) {
                            controls[field] = $card.find('input[name="' + field + '"]');
                        });
                    });


                    (function () {
                        var $dcm = controls.yearlyIncome.add(controls.budget).add(controls.companyBudget).add(controls.grant);
                        RT.jQuery.selectOnFocus($dcm.add(controls.rentMode.selector).add(controls.agencyPaidBy.selector));


                        $dcm.on('blur change', RT.jQuery.forceDecimalFormat);

                        $card.find('a.update').eq(0)
                            .on('click', function (evt) {
                                debugger;
                                evt.stopPropagation();
                                var $a = $(this);
                                if (!$a.hasClass('disabled')) {
                                    $a.addClass('disabled');


                                    let conflict = false;
                                    Promise.all([
                                        RT.jQuery.get({
                                            url: home.Route.sfExpatHomeSearch + model.expatId,
                                            contentType: false,
                                            dataType: "json"
                                        }).then(function (rs) {
                                            conflict = !(_.isEqual(rs.data.fields,model.fields));
                                            if(conflict){
                                                RT.jQuery.cancelEvent(evt);
                                                let smallScreen = window.matchMedia("(max-width: 420px)").matches;
                                                console.log('small screen' + smallScreen);
                                                new RT.Popup.create({
                                                    title: txt.dialogWriteConflict,
                                                    subtitle: txt.dialogWriteConflictSub,
                                                    top: smallScreen ? evt.clientY - 130 : evt.clientY - 130,
                                                    left: smallScreen ? 8 : evt.clientX - 10,
                                                    width: smallScreen ? 344 : 0,
                                                    height: 0,
                                                    sheet: smallScreen,
                                                    items: [{
                                                        id: "ok",
                                                        label: txt.dialogWriteConflictOk
                                                    }]
                                                }).then(function(){
                                                })
                                            }
                                            else{
                                                let rq = _.assign({
                                                    trialPeriod: controls.trialPeriod.is(':checked'),
                                                    yearlyIncome: RT.jQuery.decimalValue(controls.yearlyIncome),
                                                    budget: RT.jQuery.decimalValue(controls.budget),
                                                    companyBudget: RT.jQuery.decimalValue(controls.companyBudget),
                                                    grant: RT.jQuery.decimalValue(controls.grant),
                                                    remarks: controls.remarks.val().trim() || null,
                                                    sfhs_VisitDate: RT.jQuery.dateValue(controls.sfhs_VisitDate),
                                                    tempHousingActivated : model.tempHousingActivated
                                                }, dataChoices);
                                                if(model.tempHousingActivated){
                                                    rq.temporaryHomeBudget = RT.jQuery.decimalValue(controls.temporaryHomeBudget);
                                                    rq.temporaryHomeDuration = controls.temporaryHomeDuration.val().trim() || null;
                                                    rq.temporaryHomeExpenses = controls.temporaryHomeExpenses.val().trim() || null;
                                                    rq.dateEndOfTemporaryHome = RT.jQuery.dateValue(controls.dateEndOfTemporaryHome);

                                                }

                                                _.each(flagGroup, function (group) {
                                                    _.each(group, function (field) {
                                                        rq[field] = _.toInteger(controls[field][0].checked);
                                                    });
                                                });

                                                RT.jQuery.put({
                                                    url: home.Route.sfExpatHomeSearch + model.expatId,
                                                    data: JSON.stringify(rq),
                                                    contentType: "application/json",
                                                    dataType: false
                                                }).then(function (rs) {
                                                    return new Promise(function (resolve, reject) {
                                                        if (rs.statusCode === 205) {
                                                            console.log("updated");
                                                            location.hash = $a.attr("href");
                                                            resolve("reload");
                                                        }
                                                        else {
                                                            console.warn("unexpected update response: %O", rs);
                                                            reject(new Error("HTTP " + rs.statusCode));
                                                        }
                                                    });
                                                }).catch(function (fault) {
                                                    console.error("update fault", fault);
                                                    home.View.warn = true;
                                                });
                                            }
                                        }),
                                    ])

                                }
                                return RT.jQuery.cancelEvent(evt);
                            }).removeClass('disabled');


                        var rentMode = findById(model.fields.rentMode, model.rentMode);
                        if (rentMode) {
                            if (model.locked) {
                                controls.rentMode.val(rentMode.getName());
                            }
                            else {
                                home.jQuery.setTypeAheadValue(controls.rentMode, rentMode);
                                dataChoices.rentMode = rentMode.id;
                            }
                        }
                        var agencyPaidBy = findById(model.fields.agencyPaidBy, model.agencyPayer);
                        if (agencyPaidBy) {
                            if (model.locked) {
                                controls.agencyPaidBy.val(agencyPaidBy.getName());
                            }
                            else {
                                home.jQuery.setTypeAheadValue(controls.agencyPaidBy, agencyPaidBy);
                                dataChoices.agencyPaidBy = agencyPaidBy.id;
                            }
                        }
                    })();

                    RT.jQuery.setupHoverClass($card.find('.footer a.accent-ghost'));

                }).catch(home.View.rejectHandler);
            }
        };
    }
);