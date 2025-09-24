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
                    card: "sfExpatRelocationInfo",
                    addService: "sfService"
                };

                let log = [];

                let smallScreen = window.matchMedia("(max-width: 420px)").matches;

                let model = {
                    expatId: _.toInteger(path[1]),
                    get locked() {
                        return home.User.profile !== "SF";
                    },
                    md: { },
                    tt: {
                        get clients() {
                            let dataset = _.values(model.md.customers).sort(function (a, b) {
                                let x = home.Locale.compare(a.label, b.label);
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                label: txt.sfExpatReloSelectCustomer
                            });
                            return dataset;
                        },
                        get contacts() {
                            let dataset = _.values(model.md.customerContacts).sort(function (a, b) {//model.md.customers[dataChoices.client].contacts
                                let x = home.Locale.compare(a.cn, b.cn);
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                cn: txt.sfExpatReloSelectContact
                            });
                            return dataset;
                        }
                    },
                    reloReasonsId:[0,1,2],
                    reloReasonsLabel:{
                        0: txt.reloSetupNone,
                        1: txt.reloSetupHire,
                        2: txt.reloSetupTransfer
                    }
                };
                let dataChoices = {
                    client: null,
                    services: {},
                    newServices: {}
                };

                let images = {
                    taskDone: "ux-task-check.svg",
                    checkAll: "check_box_outline_blank.svg",
                    validated: "check_box.svg",
                    expand: "ux-circle-down.svg",
                    cancel: "ux-cancel.svg",
                    add: "ux-add.svg",
                    delete: "ux-trash.svg",
                    changePassword: "ux-key.svg",
                    duplicate: "ux-recycle.svg",
                    abandon: "ux-x.svg",
                    terminate: "ux-task-check.svg",
                    stop:"ux-stop.svg",
                    requestGDPRClean: "ux-eraser.svg"//multiple_delete.svg
                };

                if (path.length !== 2 || !_.isSafeInteger(model.expatId) || model.expatId <= 0) {
                    home.View.warn = true;
                    home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
                    return;
                }



                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.sfRelocationData + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.md.customers = rs.data.customers;
                            model.md.customerContacts = rs.data.customerContacts;
                            _.each(model.md.customers, function(it){ it.contacts = {}});

                            _.each(model.md.customerContacts, function(it){
                                model.md.customers[it.refCustomer].contacts[it.id] = it ;
                            });
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfExpat + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.expat = result.data.expat;
                            if(!model.expat.client){
                                let client = {
                                    id : 0,
                                    name : txt.sfExpatReloSelectCustomer
                                }
                                model.expat.client = client;
                            }
                            dataChoices.client = model.expat.client ? model.expat.client.id : 0;

                            if(!model.expat.reloReasonId){
                                model.expat.reloReasonId = 0;
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
                            model.task = rs.data.task;
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
                            _.each(model.callCode, function (cc) {
                                cc.getName = function () {
                                    return this.callPrefix + " － " + model.country[this.country].name;
                                };
                                cc.getName = cc.getName.bind(cc);
                            });
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
                    ])
                ]).then(function (){
                    function addNewService(newServiceId) {
                        dataChoices.newServices[newServiceId] = {};
                        dataChoices.newServices[newServiceId].id = newServiceId;
                        let $serviceTable = $card.find('.sfToDoTable').find('tbody');
                        $serviceTable.append(tpl.addService (_.assign({
                            route: home.Route,
                            images: images,
                            txt: txt,
                            fmt: fmt,
                            newServiceId: newServiceId
                        }, model)));
                        let $newService = home.View.Pane.content.find('tr.newServiceRow'+newServiceId).eq(0);

                        dataChoices.newServices[newServiceId].validate = $card.find('input[name="validateNewService'+newServiceId+'"]');
                        $newService.find('input[name="validateNewService'+newServiceId+'"]').on("click", function(){
                            mediate();
                            if(!processingClick){
                                processingClick =true;
                                let checkValidateAll = true;
                                _.each(dataChoices.services, function(u){
                                    if(!(model.expat.services[u.id].isCreated ? true : u.validate[0].checked)){
                                        checkValidateAll = false;
                                    }
                                });
                                _.each(dataChoices.newServices, function(u){
                                    if(!(u.validate[0].checked)){
                                        checkValidateAll = false;
                                    }
                                });

                                if(checkValidateAll != $validateAll[0].checked){
                                    $validateAll.click();
                                }
                                processingClick = false;
                            }
                        });
                        $newService.find('[data-action=remove'+newServiceId+']').on('click', function(evt){
                            evt.stopPropagation();
                            let id = $(this).closest('tr').data("id");
                            $(this).closest('tr').remove();
                            dataChoices.newServices[id].refService = null;
                        });

                        let pickers = {
                            restyled: RT.jQuery.restyleInputs($newService),
                            servicePicker: home.jQuery.createTypeAhead($newService.find('input[type="text"][name="nameOfNewService'+newServiceId+'"]'), {
                                name: "service",
                                identityKey: "id",
                                displayKey: "name",
                                normalize: true,
                                limit: 200,
                                minLength: 0,
                                source: (function () {
                                    let options = _.filter(_.values(model.service), function (u) {
                                        let isValidService = !(u.isFreeTask);
                                        _.each(model.expat.services, function(it){
                                            if(u.id === it.refService ){
                                                isValidService = false;
                                            }
                                        });
                                        return isValidService;
                                    });
                                    return _.constant(options.sort(function (a, b) {
                                        let x = (a.profile > b.profile ? -1 : a.profile < b.profile ? 1 : 0) || home.Locale.compare(a.name, b.name );
                                        return x ? x : a.id - b.id;
                                    }));
                                })(),
                                onSelect: function (v) {
                                    dataChoices.newServices[newServiceId].refService = v ? v.id : null;
                                    mediate();
                                }
                            }),
                            managerPicker: home.jQuery.createTypeAhead($newService.find('input[type="text"][name="managerOfNewService'+newServiceId+'"]'), {
                                name: "managerOfNewService",
                                identityKey: "id",
                                displayKey: "cn",
                                normalize: true,
                                limit: 200,
                                minLength: 0,
                                source: (function () {
                                    let options = _.filter(_.values(model.tt.staff), function (u) {
                                        return true;
                                    });
                                    return _.constant(options.sort(function (a, b) {
                                        let x = (a.profile > b.profile ? -1 : a.profile < b.profile ? 1 : 0) || home.Locale.compare(a.sn, b.sn) || home.Locale.compare(a.gn, b.gn);
                                        return x ? x : a.id - b.id;
                                    }));
                                })(),
                                onSelect: function (v) {
                                    dataChoices.newServices[newServiceId].managerId = v ? v.id : null;
                                    mediate();
                                }
                            })
                        }
                    }
                    model.expat.sortedServices = [];
                    _.each(model.expat.services, function(it){
                        it.isFreeTask = model.service[it.refService].isFreeTask;
                        it.name = model.service[it.refService].name;
                        it.staff = model.tt.staff[it.refStaff];
                        if(!it.isFreeTask){
                            dataChoices.services[it.id] = {
                                id: it.id,
                                staff: it.refStaff,
                                refService: it.refService,
                                updated: false
                            }
                        }

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


                    dataChoices.welcomer = model.expat.welcomer ? model.expat.welcomer.id : 0;
                    dataChoices.contactRh = model.expat.customerContactId;

                    home.View.warn = false;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        addNewService: addNewService,
                        tpl: tpl,
                        images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));


                    let $card = home.View.Pane.content.find('div.card').eq(0);
                    let $update = $card.find('.footer a.update').eq(0);
                    let $cancel = $card.find('div.cancelRelocation').eq(0);
                    let $terminate = $card.find('div.terminateRelocation').eq(0);
                    let $duplicate = $card.find('div.duplicateRelocation').eq(0);
                    let currentClient = dataChoices.client;
                    let $validateAll = $card.find('input[name="validateAll"]');
                    let processingClick = false;
                    if(!model.locked){
                        let $changePassword = $card.find('div.changePassword').eq(0);
                        $changePassword.on('click', function (evt) {
                            evt.stopPropagation();
                            if(!processingClick){
                                processingClick = true
                                new RT.Popup.create({
                                    title: txt.dialogConfirmChangePassword,
                                    //subtitle: txt.dialogConfirmGenerateReport,
                                    top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                    left: smallScreen ? 8 : evt.clientX - 8,
                                    width: smallScreen ? 344 : 0,
                                    height: 0,
                                    items: [{
                                        id: "confirm",
                                        label: txt.dialogConfirm
                                    }, {
                                        id: "cancel",
                                        label: txt.dialogCancel
                                    }]
                                }).then(function(result){
                                    if (_.isObject(result) && _.isString(result.id)) {
                                        switch (result.id) {
                                            case "confirm":
                                                let rq = {
                                                    requestType: 'changePassword'
                                                }
                                                RT.jQuery.put({
                                                    url: home.Route.sfRelocationData + model.expatId,
                                                    data: JSON.stringify(rq),
                                                    contentType: "application/json",
                                                    dataType: false
                                                }).then(function (rs) {

                                                    return new Promise(function (resolve, reject) {
                                                        if (rs.statusCode === 200) {
                                                            console.log("account updated");
                                                        } else {
                                                            console.warn("unexpected response update result: %O", rs);
                                                            reject(new Error("HTTP " + rs.statusCode));
                                                        }
                                                    });
                                                }).catch(function (fault) {
                                                    console.error("account update fault", fault);
                                                    home.View.warn = true;
                                                });
                                                processingClick = false;
                                                break
                                            case "cancel":
                                                processingClick = false;
                                                defaultHandler();
                                                break
                                        }
                                    }
                                })

                            }

                        });


                    }

                    let $requestGDPRClean = $card.find('div.requestGDPRClean').eq(0);
                    $requestGDPRClean.on('click', function (evt) {
                        evt.stopPropagation();
                        if(!processingClick && !controls.dataConservationAuthorization[0].checked){
                            processingClick = true
                            new RT.Popup.create({
                                title: txt.dialogConfirmGDPRClean,
                                //subtitle: txt.dialogConfirmGenerateReport,
                                top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                left: smallScreen ? 8 : evt.clientX - 8,
                                width: smallScreen ? 344 : 0,
                                height: 0,
                                items: [{
                                    id: "confirm",
                                    label: txt.dialogConfirm
                                }, {
                                    id: "cancel",
                                    label: txt.dialogCancel
                                }]
                            }).then(function(result){
                                if (_.isObject(result) && _.isString(result.id)) {
                                    switch (result.id) {
                                        case "confirm":
                                            let rq = {
                                                requestType: 'requestGDPRClean'
                                            }
                                            RT.jQuery.put({
                                                url: home.Route.sfRelocationData + model.expatId,
                                                data: JSON.stringify(rq),
                                                contentType: "application/json",
                                                dataType: false
                                            }).then(function (rs) {

                                                return new Promise(function (resolve, reject) {
                                                    if (rs.statusCode === 200) {
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
                                            break
                                        case "cancel":
                                            defaultHandler();
                                            break
                                    }
                                }
                            })
                            processingClick = false
                        }
                    });

                    let controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        clientPicker: home.jQuery.createTypeAhead($card.find('input[type="text"][name="client"]'), {
                            name: "client",
                            identityKey: "id",
                            displayKey: "label",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.clients),
                            onSelect: function (v) {

                                dataChoices.client = v ? v.id : null;
                                if(dataChoices.client != currentClient){
                                    currentClient = dataChoices.client;
                                    dataChoices.contactRh = {
                                        id: 0,
                                        cn: txt.selectContact
                                    }
                                    home.jQuery.setTypeAheadValue(controls.contactPicker, '');
                                    controls.contactPicker.selector.focus();
                                }
                                mediate();
                            }
                        }),
                        welcomerPicker: home.jQuery.createTypeAhead($card.find('input[type="text"][name="welcomer"]'), {
                            name: "welcomer",
                            identityKey: "id",
                            displayKey: "cn",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: (function () {
                                let options = _.filter(_.values(model.tt.staff), function (u) {
                                    return true;
                                });
                                return _.constant(options.sort(function (a, b) {
                                    let x = (a.profile > b.profile ? -1 : a.profile < b.profile ? 1 : 0) || home.Locale.compare(a.sn, b.sn) || home.Locale.compare(a.gn, b.gn);
                                    return x ? x : a.id - b.id;
                                }));
                            })(),
                            onSelect: function (v) {
                                dataChoices.welcomer = v ? v.id : null;
                                mediate();
                            }
                        }),

                        reloReason: $card.find('.expatRelocationRadioInput input[type="radio"]'),
                        trialPeriod: $card.find('input[name=trialPeriod]'),
                        dataConservationAuthorization: $card.find('input[name=dataConservationAuthorization]'),
                        addNewService: RT.jQuery.setupHoverClass($card.find('.addNewService')),
                        arrivalDate: $card.find('input[name="arrivalDate"]'),
                        newServiceCount: 0,
                        newServices: {}
                    }
                    if(!model.locked){
                        controls.contactPicker = home.jQuery.createTypeAhead($card.find('input[type="text"][name="contactRh"]'), {
                            name: "contactRh",
                            identityKey: "id",
                            displayKey: "cn",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: (function () {//_.constant(model.tt.contacts),
                                let options = _.filter(_.values(model.tt.contacts), function (u) {
                                    return u.refCustomer === dataChoices.client;
                                });
                                return options;}),
                            onSelect: function (v) {
                                dataChoices.contactRh = v ? v.id : null;
                                mediate();
                            }
                        });
                    }

                    _.each(model.expat.services, function(it){
                        if(!it.isFreeTask){
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
                                    let options = _.filter(_.values(model.tt.staff), function (u) {
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
                            dataChoices.services[it.id].remove = $card.find('input[name="remove'+it.id+'"]');
                            $card.find('input[name="remove'+it.id+'"]').on('click', function (){
                                dataChoices.services[it.id].updated = true;
                                mediate();
                            });
                            if(!it.isCreated){
                                dataChoices.services[it.id].validate = $card.find('input[name="validate'+it.id+'"]');
                                $card.find('input[name="validate'+it.id+'"]').on('click', function (){
                                    dataChoices.services[it.id].updated = true;
                                    if(!processingClick){
                                        processingClick = true;
                                        mediate();
                                        let checkValidateAll = true;
                                        _.each(dataChoices.services, function(u){
                                            if(!(model.expat.services[u.id].isCreated ? true : u.validate[0].checked)){
                                                checkValidateAll = false;
                                            }
                                        });
                                        _.each(dataChoices.newServices, function(u){
                                            if(!(u.validate[0].checked)){
                                                checkValidateAll = false;
                                            }
                                        });

                                        if(checkValidateAll != $validateAll[0].checked){
                                            $validateAll.click();
                                        }
                                        processingClick = false;
                                    }
                                })
                            }
                        }
                    });

                    $validateAll.on('click', function (evt){
                        evt.stopPropagation();
                        if(!processingClick){
                            processingClick = true;
                            _.each(dataChoices.services, function(it){
                                if(!(model.expat.services[it.id].isCreated ? true : false)){
                                    if(it.validate[0].checked !=  $validateAll[0].checked){
                                        $card.find('input[name="validate'+it.id+'"]').click();
                                    }
                                }
                            });
                            _.each(dataChoices.newServices, function(it){
                                if(it.validate[0].checked !=  $validateAll[0].checked){
                                    $card.find('input[name="validateNewService'+it.id+'"]').click();
                                }
                            });
                            processingClick = false;
                        }
                    })



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


                    $card.find('img.pick-birth-date').on('click', popupDatePicker);

                    controls.addNewService.on('click', function (evt){
                        evt.stopPropagation();
                        controls.newServiceCount++;
                        addNewService(controls.newServiceCount);
                        return false;
                    });
                    let mediate = function () {
                        let canSubmit = ( dataChoices.client ? dataChoices.client !== 0 : false ) &&
                            ( dataChoices.contactRh ? dataChoices.contactRh !==0 : false ) &&
                            ( dataChoices.welcomer ? dataChoices.welcomer !== 0 : false);
                        //console.log('mediate ' + canSubmit );
                        RT.jQuery.withClassIf($update, "disabled", !canSubmit);
                        let GDPRCleanAccess = controls.dataConservationAuthorization[0].checked || model.expat.dateGPDRCleared;
                        RT.jQuery.withClassIf($requestGDPRClean,"actionRelocationDisabled",GDPRCleanAccess)
                        RT.jQuery.withClassIf($requestGDPRClean,"actionRelocation",!GDPRCleanAccess)
                    };
                    mediate();

                    //controls.reloReason.on('click',mediate());
                    //controls.dataConservationAuthorization.on('click',mediate);
                    let $input = $card.find('input');
                    $input.on('change',mediate);

                    $update.on('click', function (evt) {
                        evt.stopPropagation();
                        if (!$update.hasClass("disabled")) {
                            let rq = {
                                requestType: 'update',
                                welcomer: dataChoices.welcomer,
                                client: dataChoices.client,
                                contactRh: dataChoices.contactRh,
                                services: [],
                                arrivalDate: RT.jQuery.dateValue(controls.arrivalDate),
                                trialPeriod: controls.trialPeriod[0].checked,
                                dataConservationAuthorization: controls.dataConservationAuthorization[0].checked,
                                reloReason: _.toInteger(controls.reloReason.filter(':checked').val())
                            }
                            _.each(dataChoices.services, function(it){
                                if(it.updated){
                                    let serviceDataToBeAddedToServicesWithAnS = {
                                        serviceId: it.id,
                                        managerId: it.staff,
                                        refService: it.refService,
                                        create: false,
                                        remove: it.remove[0].checked,
                                        validate: model.expat.services[it.id].isCreated ? true : it.validate[0].checked,
                                    }

                                    rq.services.push(serviceDataToBeAddedToServicesWithAnS);
                                }
                            });
                            _.each(dataChoices.newServices, function(it){
                                if(it.refService){
                                    let serviceToBeAdded = {
                                        serviceId: 0,
                                        managerId: it.managerId ? it.managerId : 0,
                                        refService: it.refService,
                                        create: true,
                                        remove: false,
                                        validate: it.validate[0].checked,
                                    }
                                    rq.services.push(serviceToBeAdded);
                                }
                            });
                            let setDefaultImmigrationStatus = function(servicesList,expatServices,code){
                                let immigrationStatus = null;
                                _.each(expatServices, function(it){
                                    if(servicesList[it.refService].serviceCode){
                                        if(servicesList[it.refService].serviceCode.includes(code)  ){
                                            immigrationStatus = servicesList[it.refService].refImmigrationStatus;
                                        }
                                    }
                                })
                                return immigrationStatus;
                            }

                            if(!model.expat.refImmigrationStatusExpat && rq.services) {
                                rq.immigrationStatusExpat = setDefaultImmigrationStatus(model.service, rq.services, 'mmigration');
                            }
                            if(!model.expat.refImmigrationStatusSpouse && rq.services) {
                                rq.immigrationStatusSpouse = setDefaultImmigrationStatus(model.service, rq.services, 'mmigrationFamily');
                            }
                            if(!model.expat.refImmigrationStatusChildren && rq.services){
                                rq.immigrationStatusChildren = setDefaultImmigrationStatus(model.service,rq.services,'mmigrationFamily');
                            }

                            RT.jQuery.put({
                                url: home.Route.sfRelocationData + model.expatId,
                                data: JSON.stringify(rq),
                                contentType: "application/json",
                                dataType: false
                            }).then(function (rs) {

                                return new Promise(function (resolve, reject) {
                                    if (rs.statusCode === 200) {
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
                        return RT.jQuery.cancelEvent(evt);
                    });


                    $cancel.on('click', function (evt) {
                        evt.stopPropagation();
                        if(!processingClick){
                            processingClick = true
                            new RT.Popup.create({
                                title: txt.dialogConfirmCancelRelocation,
                                //subtitle: txt.dialogConfirmGenerateReport,
                                top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                left: smallScreen ? 8 : evt.clientX - 8,
                                width: smallScreen ? 344 : 0,
                                height: 0,
                                items: [{
                                    id: "confirm",
                                    label: txt.dialogConfirm
                                }, {
                                    id: "cancel",
                                    label: txt.dialogCancel
                                }]
                            }).then(function(result){
                                if (_.isObject(result) && _.isString(result.id)) {
                                    switch (result.id) {
                                        case "confirm":

                                            let rq = {
                                                requestType: 'cancel'
                                            }
                                            RT.jQuery.put({
                                                url: home.Route.sfRelocationData + model.expatId,
                                                data: JSON.stringify(rq),
                                                contentType: "application/json",
                                                dataType: false
                                            }).then(function (rs) {

                                                return new Promise(function (resolve, reject) {
                                                    if (rs.statusCode === 200) {
                                                        console.log("account updated");
                                                        home.Router.go(["sofimeExpats"]);
                                                    } else {
                                                        console.warn("unexpected response update result: %O", rs);
                                                        reject(new Error("HTTP " + rs.statusCode));
                                                    }
                                                });
                                            }).catch(function (fault) {
                                                console.error("account update fault", fault);
                                                home.View.warn = true;
                                            });
                                            processingClick = false
                                            break
                                        case "cancel":
                                            defaultHandler();
                                            processingClick = false
                                            break
                                    }
                                }
                            })
                        }
                    });

                    $duplicate.on('click', function (evt) {
                        evt.stopPropagation();
                        if(!processingClick){
                            processingClick = true
                            new RT.Popup.create({
                                title: txt.dialogConfirmDuplicateRelocation,
                                subtitle: txt.dialogConfirmDuplicateRelocationSubtitle,
                                top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                left: smallScreen ? 8 : evt.clientX - 130,
                                width: smallScreen ? 344 : 0,
                                height: 0,
                                items: [{
                                    id: "confirm",
                                    label: txt.dialogConfirmDuplicateRelocationButton
                                }, {
                                    id: "cancel",
                                    label: txt.dialogCancel
                                }]
                            }).then(function(result){
                                if (_.isObject(result) && _.isString(result.id)) {
                                    switch (result.id) {
                                        case "confirm":
                                            let rq = {
                                                requestType: 'duplicate'
                                            }
                                            RT.jQuery.put({
                                                url: home.Route.sfRelocationData + model.expatId,
                                                data: JSON.stringify(rq),
                                                contentType: "application/json",
                                                dataType: false
                                            }).then(function (rs) {

                                                return new Promise(function (resolve, reject) {
                                                    if (rs.statusCode === 200) {
                                                        console.log("account updated");
                                                        home.Router.go(["sfExpatRelocationInfo", rs.data.newId]);
                                                    } else {
                                                        console.warn("unexpected response update result: %O", rs);
                                                        reject(new Error("HTTP " + rs.statusCode));
                                                    }
                                                });
                                            }).catch(function (fault) {
                                                console.error("account update fault", fault);
                                                home.View.warn = true;
                                            });
                                            break
                                        case "cancel":
                                            new RT.Popup.create({
                                                title: txt.dialogConfirmCancelRelocation,
                                                //subtitle: txt.dialogConfirmGenerateReport,
                                                top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                                left: smallScreen ? 8 : evt.clientX - 8,
                                                width: smallScreen ? 344 : 0,
                                                height: 0,
                                                items: [{
                                                    id: "confirm",
                                                    label: txt.dialogConfirm
                                                }, {
                                                    id: "cancel",
                                                    label: txt.dialogCancel
                                                }]
                                            }).then(function(result){
                                                if (_.isObject(result) && _.isString(result.id)) {
                                                    switch (result.id) {
                                                        case "confirm":
                                                            let rq = {
                                                                requestType: 'cancel'
                                                            }
                                                            RT.jQuery.put({
                                                                url: home.Route.sfRelocationData + model.expatId,
                                                                data: JSON.stringify(rq),
                                                                contentType: "application/json",
                                                                dataType: false
                                                            }).then(function (rs) {

                                                                return new Promise(function (resolve, reject) {
                                                                    if (rs.statusCode === 200) {
                                                                        console.log("account updated");
                                                                        home.Router.go(["sofimeExpats"]);
                                                                    } else {
                                                                        console.warn("unexpected response update result: %O", rs);
                                                                        reject(new Error("HTTP " + rs.statusCode));
                                                                    }
                                                                });
                                                            }).catch(function (fault) {
                                                                console.error("account update fault", fault);
                                                                home.View.warn = true;
                                                            });
                                                            processingClick = false
                                                            break
                                                        case "cancel":
                                                            processingClick = false
                                                            defaultHandler();
                                                            break
                                                    }
                                                }
                                            })
                                            defaultHandler();
                                            break
                                    }
                                }
                            })
                        }
                    });

                    $terminate.on('click', function (evt) {
                        evt.stopPropagation();
                        if(!processingClick){
                            processingClick = true
                            new RT.Popup.create({
                                title: txt.dialogConfirmTerminateRelocation,
                                //subtitle: txt.dialogConfirmGenerateReport,
                                top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                left: smallScreen ? 8 : evt.clientX - 8,
                                width: smallScreen ? 344 : 0,
                                height: 0,
                                items: [{
                                    id: "confirm",
                                    label: txt.dialogConfirm
                                }, {
                                    id: "cancel",
                                    label: txt.dialogCancel
                                }]
                            }).then(function(result){
                                if (_.isObject(result) && _.isString(result.id)) {
                                    switch (result.id) {
                                        case "confirm":
                                            let rq = {
                                                requestType: 'terminate'
                                            }
                                            RT.jQuery.put({
                                                url: home.Route.sfRelocationData + model.expatId,
                                                data: JSON.stringify(rq),
                                                contentType: "application/json",
                                                dataType: false
                                            }).then(function (rs) {

                                                return new Promise(function (resolve, reject) {
                                                    if (rs.statusCode === 200) {
                                                        console.log("account updated");
                                                        home.Router.go(["sofimeExpats"]);
                                                    } else {
                                                        console.warn("unexpected response update result: %O", rs);
                                                        reject(new Error("HTTP " + rs.statusCode));
                                                    }
                                                });
                                            }).catch(function (fault) {
                                                console.error("account update fault", fault);
                                                home.View.warn = true;
                                            });
                                            processingClick = false
                                            break
                                        case "cancel":
                                            processingClick = false
                                            RT.defaultHandler();
                                            break
                                    }
                                }
                            })
                        }

                    });
                }).catch(home.View.rejectHandler);
            },


        };
})