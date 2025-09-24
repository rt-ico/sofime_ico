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
                    card: "sfExpatRelocationCreate",
                    addService: "sfService"
                };

                let log = [];

                let model = {
                    get locked() {
                        return home.User.profile !== "SF";
                    },
                    lockedInput: {
                        expatFileLoadDate: true,
                        temporaryNumberReceptionDate: true,
                        spouse: true,
                    },
                    md: {
                        clients: {}
                    },
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
                    create: "check_box_outline_blank.svg",
                    validated: "check_box.svg",
                    expand: "ux-circle-down.svg",
                    cancel: "ux-cancel.svg",
                    add: "ux-add.svg",
                    delete: "ux-trash.svg"
                };


                /*if (path.length !== 2 || !_.isSafeInteger(model.expatId) || model.expatId <= 0) {
                    home.View.warn = true;
                    home.View.Pane.content[0].innerHTML = "<code>invalid path ou pas</code>";
                    return;
                }*/



                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.sfRelocationData,
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
                        }),
                    ])]).then(function (){

                    dataChoices.welcomer = 0;
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
                    let currentClient = 0;

                    let controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        gender: $card.find('input[name="gender"]'),
                        sn: $card.find('input[name="sn"]'),
                        gn: $card.find('input[name="gn"]'),
                        workMail: $card.find('input[name="workMail"]'),
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
                        contactPicker: home.jQuery.createTypeAhead($card.find('input[type="text"][name="contactRh"]'), {
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
                        })
                    }

                    RT.jQuery.trimOnBlur(controls.sn
                        .add(controls.gn)
                        .add(controls.workMail)
                    );

                    let mediate = function () {
                        let canSubmit = dataChoices.welcomer !== null
                        && dataChoices.client !== null
                        && dataChoices.contactRh
                        && controls.sn.val() !== ""
                        && controls.gn.val() !== ""
                        && controls.workMail.val() !== "";

                        RT.jQuery.withClassIf($update, "disabled", !canSubmit);
                    };

                    $card.find('input[type="text"]').on('change', mediate);
                    $card.find('input[type="email"]').on('change', mediate);


                    $update.on('click', function (evt) {
                        evt.stopPropagation();
                        if (!$update.hasClass("disabled")) {

                            let rq = {
                                gender: _.toInteger(controls.gender.filter(':checked').val()),
                                welcomer: dataChoices.welcomer,
                                client: dataChoices.client,
                                contactRh: dataChoices.contactRh,
                                sn: controls.sn.val(),
                                gn: controls.gn.val(),
                                workMail: controls.workMail.val()
                            }


                            RT.jQuery.put({
                                url: home.Route.sfRelocationCreate,
                                data: JSON.stringify(rq),
                                contentType: "application/json",
                                dataType: false
                            }).then(function (rs) {

                                return new Promise(function (resolve, reject) {
                                    if (rs.statusCode === 200) {
                                        if(rs.data.alreadyExists){
                                            RT.Popup.create({
                                                title: txt.sfExpatRelocationAlreadyExists,
                                                subtitle: txt.sfExpatRelocationAlreadyExistsSub,
                                                top: evt.clientY - 8,
                                                left: evt.clientX - 8,
                                                width: 0,
                                                height: 0,
                                                items: [{
                                                    id: "redirect",
                                                    label: txt.actionRedirect
                                                },
                                                {
                                                    id: "stay",
                                                    label: txt.actionStayAndModify
                                                }]
                                            }).then(function(result){
                                                if (_.isObject(result) && _.isString(result.id)) {
                                                    switch (result.id) {
                                                        case "redirect":
                                                            home.Router.go(["sfExpatRelocationInfo", rs.data.newId]);
                                                            break;
                                                        case "stay":
                                                            controls.workMail.focus();
                                                            defaultHandler();
                                                            break
                                                    }
                                                }
                                            });
                                        }
                                        else{
                                            console.log("created relocation");
                                            home.Router.go(["sfExpatRelocationInfo", rs.data.newId]);
                                        }
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

                }).catch(home.View.rejectHandler);

            },


        };
    })