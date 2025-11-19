define(
    ['app/home', 'app/RT', 'app/datePicker', 'jquery', 'lodash', 'moment'],
    function (home, RT, datePicker, $, _, moment) {
        "use strict";
        let ctx = null;
        let jst = null;
        let txt = RT.Text;
        let fmt = RT.Format;
        let cachedMoment = RT.Time.createMomentCache();
        let MOMENT_TODAY = moment().startOf('day');
        let MOMENT_UPPER = MOMENT_TODAY.clone().add(36, 'month');
        let MOMENT_FLOOR = MOMENT_TODAY.clone().subtract(16, 'year');
        let MOMENT_AS_OF = moment('2019-01-01').startOf('day');


        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },

            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {

                home.Profile.requireSofime();
                home.View.actions = null;

                let tpl = {
                    card: "sfExpatImmigration",
                };

                let log = [];

                let model = {
                    smallScreen: window.matchMedia("(max-width: 420px)").matches,
                    expatId: _.toInteger(path[1]),
                    get locked() {
                        return home.User.profile !== "SF";
                    },
                    md : {
                    },
                    tt: {
                        get paperlessStatuses() {
                            let dataset = _.values(model.md.paperlessStatuses).sort(function (a, b) {
                                let x = home.Locale.compare(a.label, b.label);
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                label: txt.sfExpatReloSelectPaperlessStatus
                            });
                            return dataset;
                        },
                        get immigrationStatuses() {
                            let dataset = _.values(model.md.immigrationStatuses).sort(function (a, b) {
                                let x = home.Locale.compare(a.label, b.label);
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                label: txt.sfExpatReloSelectImmigrationStatus
                            });
                            return dataset;
                        },
                    }


                };

                let images = {
                    taskDone: "ux-task-check.svg",
                    missing: "sign_warning.svg"
                    //create: "check_box_outline_blank.svg",
                    //validated: "check_box.svg",
                    //expand: "ux-circle-down.svg",
                    //cancel: "ux-cancel.svg",
                    //add: "ux-add.svg",
                    //delete: "ux-trash.svg"
                };

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
                            let serviceCategory = {};
                            serviceCategory['uncategorized'] = {};
                            serviceCategory['uncategorized'].services = {};
                            serviceCategory['uncategorized'].displayed = false;

                            _.each(rs.data.serviceCategory, function(it){
                                it.services = {};
                                serviceCategory[it.id] = it;
                                serviceCategory[it.id].displayed = true;
                            });
                            _.each(rs.data.service, function(it){
                                if(serviceCategory[it.category]){
                                    serviceCategory[it.category].services[it.id] = it;
                                }
                                else{
                                    serviceCategory['uncategorized'].services[it.id] = it;
                                }
                            });
                            model.serviceCategory = serviceCategory;
                            model.md.paperlessStatuses = rs.data.paperlessStatuses;
                            model.md.immigrationStatuses = rs.data.immigrationStatuses;
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfExpat + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.expat = rs.data.expat;
                            model.familyServiceActivated = false;
                            model.dcemServiceActivated = false;
                            _.each(model.expat.services, function(it){
                                if(it.isImmigrationFamily){
                                    model.familyServiceActivated = true;
                                }
                            })
                        }),
                        RT.jQuery.get({
                            url: home.Route.staffData + home.User.id,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            let all = [];
                            _.each(["SF", "CT"], function (k) {
                                all = all.concat(result.data[k]);
                                _.each(result.data[k], function (u) {
                                    u.profile = k;
                                });
                            });
                            model.tt.staff = _.keyBy(all, "id")
                        })
                        /*RT.jQuery.get({
                            url: home.Route.sfImmigrationData + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                        })*/
                    ])
                ]).then(function (){

                    model.expat.sortedServices = [];
                    _.each(model.expat.services, function(it){
                        it.isFreeTask = model.service[it.refService].isFreeTask;
                        it.isImmigration = model.service[it.refService].category === 1;
                        it.name = model.service[it.refService].name;
                        it.staff = model.tt.staff[it.refStaff];
                        model.expat.sortedServices.push(it);
                    });


                    model.expat.sortedServices.sort(function (a, b) {
                        if (a.name < b.name) {
                            return -1;
                        }
                        if (a.name > b.name) {
                            return 1;
                        }
                        return 0;
                    });
                    home.View.warn = false;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        tpl: tpl,
                        images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));


                    let $card = home.View.Pane.content.find('div.card').eq(0);
                    let $update = $card.find('.footer a.update').eq(0);

                    let controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        dateConsulate: $card.find('input[name="dateConsulate"]'),
                        datePrefecture: $card.find('input[name="datePrefecture"]'),
                        dateEndResPermit: $card.find('input[name="dateEndResPermit"]'),
                        dateSpouseEndResPermit: $card.find('input[name="dateSpouseEndResPermit"]'),
                        dateEndVisa: $card.find('input[name="dateEndVisa"]'),
                        dateStartVisa: $card.find('input[name="dateStartVisa"]'),
                        dateEndVisaSpouse: $card.find('input[name="dateEndVisaSpouse"]'),
                        prefecture: $('#prefecture'),
                        expatForeignNumber: $card.find('input[name="expatForeignNumber"]'),
                        anefPass: $card.find('input[name="anefPass"]'),
                        immigId: $card.find('input[name="immigId"]'),
                        expatTel: $card.find('input[name="expatTel"]'),
                        paperLessImmigration: home.jQuery.createTypeAhead($card.find('input[type="text"][id="paperLessImmigration"]'), {
                            name: "paperLessImmigration",
                            identityKey: "id",
                            displayKey: "label",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.paperlessStatuses),
                            onSelect: function (v) {
                                if (v && v.id) {
                                    dataChoices.paperlessStatus = v.id;
                                }
                                else {
                                    dataChoices.paperlessStatus = 0;
                                }
                                mediate();
                            }
                        }),

                        immigrationStatusExpat: home.jQuery.createTypeAhead($card.find('input[type="text"][id="immigrationStatusExpat"]'), {
                            name: "immigrationStatusExpat",
                            identityKey: "id",
                            displayKey: "label",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.immigrationStatuses),
                            onSelect: function (v) {
                                if (v && v.id) {
                                    dataChoices.immigrationStatusExpat = v.id;
                                }
                                else {
                                    dataChoices.immigrationStatusExpat = 0;
                                }
                                mediate();
                            }
                        }),
                    }

                    if(model.familyServiceActivated){
                        controls.immigrationStatusSpouse = home.jQuery.createTypeAhead($card.find('input[type="text"][id="immigrationStatusSpouse"]'), {
                            name: "Spouse",
                            identityKey: "id",
                            displayKey: "label",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.immigrationStatuses),
                            onSelect: function (v) {
                                if (v && v.id) {
                                    dataChoices.immigrationStatusSpouse = v.id;
                                }
                                else {
                                    dataChoices.immigrationStatusSpouse = 0;
                                }
                                mediate();
                            }
                        });
                        controls.immigrationStatusChildren = home.jQuery.createTypeAhead($card.find('input[type="text"][id="immigrationStatusChildren"]'), {
                            name: "immigrationStatusChildren",
                            identityKey: "id",
                            displayKey: "label",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.immigrationStatuses),
                            onSelect: function (v) {
                                if (v && v.id) {
                                    dataChoices.immigrationStatusChildren = v.id;
                                }
                                else {
                                    dataChoices.immigrationStatusChildren = 0;
                                }
                                mediate();
                            }
                        });
                    }

                    let dataChoices = {
                        services: {},
                        immigrationStatusExpat: {},
                        immigrationStatusSpouse: {},
                        immigrationStatusChildren: {}
                    }

                    _.each(model.expat.services, function(it){
                        if(it.isImmigration){
                            dataChoices.services[it.id] = {
                                id: it.id,
                                staff: it.refStaff,
                                updated: false
                            }
                            let target = 'input[type="text"][name="managerOf'+it.id+'"]';
                            let targetName = 'managerOf'+it.id;
                            controls.managerPicker = home.jQuery.createTypeAhead($card.find(target), {
                                name: targetName,
                                identityKey: "id",
                                displayKey: "cn",
                                normalize: true,
                                limit: 200,
                                minLength: 0,
                                source: (function () {
                                    let options = _.filter(_.values(model.tt.staff), function () {
                                        return true;
                                    });
                                    return _.constant(options.sort(function (a, b) {
                                        let x = (a.profile > b.profile ? -1 : a.profile < b.profile ? 1 : 0) || home.Locale.compare(a.sn, b.sn) || home.Locale.compare(a.gn, b.gn);
                                        return x ? x : a.id - b.id;
                                    }));
                                })(),
                                onSelect: function (v) {
                                    dataChoices.services[it.id].staff = v ? v.id : null;
                                    dataChoices.services[it.id].updated = true;
                                    mediate();
                                }
                            });
                        }
                    });


                    if(model.familyServiceActivated){
                        controls.spouseForeignNumber = $card.find('input[name="spouseForeignNumber"]');
                        controls.spouseAnefPass = $card.find('input[name="spouseAnefPass"]');
                        controls.spouseImmigId = $card.find('input[name="spouseImmigId"]');
                        controls.spouseTel = $card.find('input[name="spouseTel"]');
                        controls.dateConsulateFamily = $card.find('input[name="dateConsulateFamily"]');
                        controls.datePrefectureFamily = $card.find('input[name="datePrefectureFamily"]');
                    }

                    if(model.familyServiceActivated){
                        controls.child1ForeignNumber = $card.find('input[name="child1ForeignNumber"]');
                        controls.child1AnefPass = $card.find('input[name="child1AnefPass"]');
                        controls.child1ImmigId = $card.find('input[name="child1ImmigId"]');
                        controls.child1Tel = $card.find('input[name="child1Tel"]');
                        controls.child2ForeignNumber = $card.find('input[name="child2ForeignNumber"]');
                        controls.child2AnefPass = $card.find('input[name="child2AnefPass"]');
                        controls.child2ImmigId = $card.find('input[name="child2ImmigId"]');
                        controls.child2Tel = $card.find('input[name="child2Tel"]');
                    }

                    $card.find('img.pick-birth-date').on('click', popupDatePicker);

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
                        }).then(function (result) {
                            mediate();
                        }).catch(home.View.rejectHandler);
                    }

                    let mediate = function () {
                        let canSubmit = true;
                        RT.jQuery.withClassIf($update, "disabled", !canSubmit);
                    };

                    let $txt = $card.find('input[type="text"]:not(.combo), input[type="tel"], textarea');
                    $txt.on('change', mediate);
                    function sendAjaxRequest(rq){
                        RT.jQuery.put({
                            url: home.Route.sfImmigrationData + model.expatId,
                            data: JSON.stringify(rq),
                            contentType: "application/json",
                            dataType: false
                        }).then(function (rs) {

                            return new Promise(function (resolve, reject) {
                                if (rs.statusCode === 205) {
                                    console.log("account updated");
                                    location.reload();
                                    resolve("reload");
                                } else {
                                    console.warn("unexpected response update result: %O", rs);
                                    reject(new Error("HTTP " + rs.statusCode));
                                }
                            });
                        }).catch(function (fault) {
                            console.error("account update fault", fault);
                            home.View.warn = true;
                        });
                    }

                    /*let $back = RT.jQuery.setupHoverClass($card.find('.footer a.back'));
                    $back.on("click", function (evt) {
                        window.history.back();
                        return RT.jQuery.cancelEvent(evt);
                    });*/

                    let $toImmigrationDocuments = $card.find('.footer a.toImmigrationDocuments').eq(0);
                    $toImmigrationDocuments.on('click', function(evt){
                        home.Router.go(["sfExpatDocs/" + model.expatId+"/browse/isImmigration"]);
                    })

                    $update.on('click', function (evt) {
                        evt.stopPropagation();
                        if (!$update.hasClass("disabled")) {
                            $update.addClass('disabled');
                            let canSubmit = true;
                            debugger;
                            let mandatoryFieldsCheck = controls.expatForeignNumber.val() != 0 ;
                            let mandatoryList = [
                                {
                                    name:'paperless',
                                    value: dataChoices.paperlessStatus != null,
                                    icon: $card.find('.paperlessMissingIcon')
                                }
                            ];
                            if(mandatoryFieldsCheck){
                                _.each(mandatoryList,function(it){
                                    if(it.value){
                                        RT.jQuery.withClassIf(it.icon,'visibilityOff', true );
                                    }
                                    else{
                                        RT.jQuery.withClassIf(it.icon,'visibilityOff', false );
                                        canSubmit = false
                                    }
                                })
                            }
                            else{
                                _.each(mandatoryList,function(it){
                                    RT.jQuery.withClassIf(it.icon,'visibilityOff', true );
                                })
                            }
                            if(canSubmit){
                                let rq = {
                                    prefecture: controls.prefecture.val(),
                                    expatForeignNumber: controls.expatForeignNumber.val(),
                                    immigId: controls.immigId.val(),
                                    anefPass: controls.anefPass.val(),
                                    expatTel: controls.expatTel.val(),
                                    dateEndVisa: RT.jQuery.dateValue(controls.dateEndVisa),
                                    dateStartVisa: RT.jQuery.dateValue(controls.dateStartVisa),
                                    dateConsulate: RT.jQuery.dateValue(controls.dateConsulate),
                                    datePrefecture: RT.jQuery.dateValue(controls.datePrefecture),
                                    dateEndResPermit: RT.jQuery.dateValue(controls.dateEndResPermit),
                                    dateSpouseEndResPermit: RT.jQuery.dateValue(controls.dateSpouseEndResPermit),
                                    serviceFamilyActive : model.familyServiceActivated,
                                    DCEMActive : model.dcemServiceActivated,
                                    services: [],
                                    paperlessStatus: dataChoices.paperlessStatus,
                                    immigrationStatusExpat: dataChoices.immigrationStatusExpat
                                }

                                _.each(dataChoices.services, function(it){
                                    if(it.updated){
                                        let updatedService = {
                                            serviceId: it.id,
                                            managerId: it.staff,
                                        }

                                        rq.services.push(updatedService);
                                    }
                                });
                                if(model.familyServiceActivated){
                                    rq.spouseForeignNumber = controls.spouseForeignNumber.val();
                                    rq.spouseAnefPass = controls.spouseAnefPass.val();
                                    rq.spouseImmigId = controls.spouseImmigId.val();
                                    rq.spouseTel = controls.spouseTel.val();
                                    rq.dateConsulateFamily = RT.jQuery.dateValue(controls.dateConsulateFamily);
                                    rq.datePrefectureFamily = RT.jQuery.dateValue(controls.datePrefectureFamily);
                                    rq.dateEndVisaSpouse = RT.jQuery.dateValue(controls.dateEndVisaSpouse);
                                    rq.immigrationStatusSpouse = dataChoices.immigrationStatusSpouse;
                                    rq.immigrationStatusChildren = dataChoices.immigrationStatusChildren;
                                }

                                if(model.familyServiceActivated){
                                    rq.child1ForeignNumber = controls.child1ForeignNumber.val();
                                    rq.child1AnefPass = controls.child1AnefPass.val();
                                    rq.child1ImmigId = controls.child1ImmigId.val();
                                    rq.child1Tel = controls.child1Tel.val();
                                    rq.child2ForeignNumber = controls.child2ForeignNumber.val();
                                    rq.child2AnefPass = controls.child2AnefPass.val();
                                    rq.child2ImmigId = controls.child2ImmigId.val();
                                    rq.child2Tel = controls.child2Tel.val();
                                }


                                sendAjaxRequest(rq);
                            }

                        }
                        return RT.jQuery.cancelEvent(evt);
                    });


                })
            }


        }


    })

