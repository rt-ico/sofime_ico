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
        let MOMENT_UPPER = MOMENT_TODAY.clone().add(9, 'month');
        let MOMENT_FLOOR = MOMENT_TODAY.clone().subtract(16, 'year');
        let MOMENT_AS_OF = moment('2019-01-01').startOf('day');

        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },
            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {

                home.Profile.require('SF');
                home.View.actions = null;

                let tpl = {
                    card: "sfExpatSocialSecurity",
                    familyMember: "expatFamilySocialSecurity",
                    popup: "sfTodoPopup"
                };

                //alert(home.Route.themeStyleUri + 'media/flag/');

                let model = {
                    smallScreen: window.matchMedia("(max-width: 420px)").matches,
                    expatId: _.toInteger(path[1]),
                    get locked() {
                        return home.User.profile !== "SF";
                    },
                    lockedInput: {
                        expatFileLoadDate: false,
                        temporaryNumberReceptionDate: false,
                        spouse: true,
                    },
                    moment: {
                        today: moment().startOf("day")
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
                    }
                };

                let images = {
                    add: "ux-add.svg",
                    remove: "ux-trash.svg",
                    visibility: "ux-eye-off.svg",
                    expand: "ux-circle-down.svg",
                    user: "ux-user.svg",
                    update: "ux-save.svg",
                    mail: "ux-mail.svg",
                    taskDone: "ux-task-check.svg",
                    taskNA: "ux-na.svg",
                    dismissSvg: "ux-cancel.svg",
                    missing: "sign_warning.svg"
                };

                let dataChoices = {};

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
                            url: home.Route.masterData,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {

                            model.gender = rs.data.gender;
                            model.country = rs.data.country;
                            model.callCode = rs.data.callCode;
                            model.familyRelation = rs.data.familyRelation;
                            model.task = rs.data.task;

                            _.each(model.callCode, function (cc) {
                                cc.getName = function () {
                                    return this.callPrefix + " － " + model.country[this.country].name;
                                };
                                cc.getName = cc.getName.bind(cc);
                            });
                            model.md.paperlessStatuses = rs.data.paperlessStatuses;
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfTaskTodo,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.tasksTodo = rs.data.tasksTodo;
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfExpat + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {

                            model.expat = result.data.expat;
                            model.expat.hasFamilyEnabled = false;
                            _.each(model.expat.services, function(it){
                                if(it.isSocialSecurityFamily){
                                    model.expat.hasFamilyEnabled = true;
                                }
                            });
                            model.expat.spouseExists = false;
                            _.each(model.expat.familyMembers, function (member) {

                                if (member.familyRelation === 1) {
                                    model.expat.spouse = member;
                                    model.expat.spouseExists = true;//rustine
                                }
                            });
                            if (model.expat.spouseExists === false) {
                                model.expat.spouse = [];
                            }
                            if (!_.isObject(model.expat) || !model.expat.id || !model.expat.cn) {
                                throw new Error("expat(" + model.expatId + "): unexpected response");
                            }
                            if (_.isInteger(model.expat.birthCountry)) {
                                dataChoices.birthCountry = model.expat.birthCountry;
                            }
                            if (_.isInteger(model.expat.telZone1)) {
                                dataChoices.telZone1 = model.expat.telZone1;
                            }
                            if (_.isInteger(model.expat.telZone2)) {
                                dataChoices.telZone2 = model.expat.telZone2;
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


                    model.tasksTodo = _.filter(model.tasksTodo, function (it) {
                        return it.nextTask && (it.expat.id === model.expatId);
                    })
                    _.each(model.tasksTodo, function (it) {
                        it.task = model.task[it.task];

                    });

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

                    function toFamilyMember($fm) {
                        let fm = {
                            id: $fm.data("id"),
                            familyRelation: 2,
                            sn: $fm.find('.surName input').eq(0).val().trim(),
                            gn: $fm.find('.givenName input').eq(0).val().trim(),
                            birthDate: RT.jQuery.dateValue($fm.find('.birthDate input').eq(0)),
                            SIN: $fm.find('.SIN input').eq(0).val().trim(),
                            remarks: $fm.find('.remarks input').eq(0).val().trim()
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

                    function removeFamilyMember(evt) {
                        let $fm = $(this).closest('.family-member');
                        let fm = toFamilyMember($fm);
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
                                    $fm.remove();

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
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        defineFamilyMemberTemplateData: defineFamilyMemberTemplateData,
                        tpl: tpl,
                        images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    let $card = home.View.Pane.content.find('div.card').eq(0);

                    let $sendMail = $card.find('[data-action=sendMail]');
                    RT.jQuery.setupHoverClass($sendMail).on('click', function (evt) {
                        let $card = $(this);
                        let outboxmailId = $card.data("xt");
                        if (!_.isInteger(outboxmailId) || outboxmailId < 1) {
                            throw new Error("Outbox Mail Id");
                        }
                        home.Router.go(["sfMailItem", outboxmailId]);
                    });

                    let $validate = $card.find('[data-action=validateTask]');
                    RT.jQuery.setupHoverClass($validate).on('click', function (evt) {
                        updateForm(evt);
                        let $card = $(this);
                        let expatTaskId = $card.data("xt");
                        RT.jQuery.get({
                            url: home.Route.sfTaskTodo + expatTaskId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            let expatTask = rs.data.tasksTodo[0];
                            let task = model.task[expatTask.task];

                            let rq = {
                                action: 'done',
                                remarks: task.remarks ? task.remarks : null,
                                deadline: task.deadline ? task.deadline : null,
                                visit: task.visit ? task.visit : null,
                                rdvdate: task.rdv_date ? task.rdv_date : null,
                                rdvtime: task.rdv_time ? task.rdv_time : null,
                                updateRemarks: false
                            };

                            return rq;
                        }).then(function (result) {
                            if (_.isObject(result) && result.action) {
                                return RT.jQuery.post({
                                    url: home.Route.sfTaskTodo + expatTaskId,
                                    data: JSON.stringify(result),
                                    contentType: "application/json",
                                    dataType: false
                                }).then(function (rs) {
                                    if (rs.statusCode !== 205) { // RESET_CONTENT
                                        console.warn("unexpected response update result: %O", rs.statusCode);
                                        throw new Error("HTTP " + rs.statusCode);
                                    }
                                    home.Router.update();
                                    return result;
                                });
                            }
                            return result;
                        }).catch(function (fault) {
                            console.error("expat_task(%s): dialog fault", expatTaskId, fault);
                            home.View.warn = true;
                            setTimeout(function () {
                                home.View.warn = false;
                                home.Router.update();
                            }, 2000);
                        });
                    });


                    let $update = $card.find('.footer a.update').eq(0);

                    let controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        sn: $card.find('input[name="sn"]'),
                        gn: $card.find('input[name="gn"]'),
                        birthDate: $card.find('input[name="birthDate"]'),
                        expatFileLoadDate: $card.find('input[name="expatFileLoadDate"]'),
                        temporaryNumberReceptionDate: $card.find('input[name="temporaryNumberReceptionDate"]'),
                        lastActionDate: $card.find('input[name="lastActionDate"]'),
                        spouseBirthDate: $card.find('input[name="spouseBirthDate"]'),
                        addressFinal: $card.find('input[name="addressFinal"]'),
                        iban: $card.find('input[name="iban"]'),
                        SIN: $card.find('input[name="SIN"]'),
                        spouseSn: $card.find('input[name="spouseSn"]'),
                        spouseGn: $card.find('input[name="spouseGn"]'),
                        spouseSIN: $card.find('input[name="spouseSIN"]'),
                        ameliAuthSpouse: $card.find('input[name="ameliAuthSpouse"]'),
                        ameliAuth: $card.find('input[name="ameliAuth"]'),
                        expatAmeliMail: $card.find('input[name="expatAmeliMail"]'),
                        spouseAmeliMail: $card.find('input[name="spouseAmeliMail"]'),
                        socialSecurityRemark: $('#socialSecurityRemark'),
                        socialSecurityFamilyRemark: $('#socialSecurityFamilyRemark'),
                        isSensitive: $card.find('input[name="isSensitive"]'),
                        isWaitingForExpat: $card.find('input[name="isWaitingForExpat"]'),
                        isWaitingForCpam: $card.find('input[name="isWaitingForCpam"]'),
                        paperLessImmigration: home.jQuery.createTypeAhead($card.find('input[type="text"][id="paperlessSocialSecurity"]'), {
                            name: "paperlessSocialSecurity",
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

                        addFamilyMember: RT.jQuery.setupHoverClass($card.find('.family-members > a.add')),
                        tasks: [],

                    };
                    {
                        let i = 0;
                        _.each(model.tasksTodo, function (it) {
                            controls.tasks[i] = {};
                            controls.tasks[i].deadline = $card.find('input[name="deadlineOf' + it.id + '"]');
                            controls.tasks[i].remarks = $card.find('input[name="remarksOf' + it.id + '"]');
                            controls.tasks[i].id = it.id;
                            i++;
                        });
                    }

                    RT.jQuery.setupHoverClass($card.find('.family-members a.remove')).on('click', removeFamilyMember);

                    let mediate = function () {
                        console.log('mediate');

                        let canSubmit = true;
                        /*if (canSubmit) {
                            let fmCount = 0;
                            let fmArray = [];
                            $card.find('.family-member').each(function () {
                                fmCount++;
                                let fm = toFamilyMember($(this));
                                if (isValidFamilyMember(fm)) {
                                    fmArray.push(fm);
                                }
                            });
                            if (fmCount > fmArray.length) canSubmit = false;
                        }*/
                        RT.jQuery.withClassIf($update, "disabled", !canSubmit);
                    };

                    (function () {
                        $card.find('input.date').on('blur change', RT.jQuery.forceDateFormat);

                        let $txt = $card.find('input[type="text"]:not(.combo), input[type="email"], input[type="checkbox"], input[type="tel"], textarea');
                        $txt.on('change', mediate);


                        controls.sn.on('change', function () {
                            let v1 = this.value;
                            let v2 = fmt.Capitalize.all(v1);
                            if (v1 !== v2) this.value = v2;
                        });
                        controls.gn.on('change', function () {
                            let v1 = this.value;
                            let v2 = fmt.Capitalize.start(v1);
                            if (v1 !== v2) this.value = v2;
                        });


                        controls.addFamilyMember.on('click', function (evt) {
                            let fragment = tpl.familyMember(defineFamilyMemberTemplateData(null));
                            let inserted = $(fragment).insertBefore($(this));

                            RT.jQuery.restyleInputs(inserted);
                            RT.jQuery.setupHoverClass(inserted.find('a.remove')).on('click', removeFamilyMember);
                            inserted.find('img.pick-birth-date').on('click', popupBirthDatePicker);
                            inserted.find('input.date').on('blur change', RT.jQuery.forceDateFormat);

                            let $txt = inserted.find('input[type="text"]')
                                .on('input change', mediate);
                            RT.jQuery.selectOnFocus($txt);
                            RT.jQuery.trimOnBlur($txt);

                            let $select = inserted.find('select')
                                .on('change', mediate);
                            setTimeout(function () {
                                $select.eq(0).focus();
                            }, 20);

                            $update.addClass("disabled");
                            return RT.jQuery.cancelEvent(evt);
                        });

                    })();

                    function popupBirthDatePicker() {
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
                            // if (moment.isMoment(result)) { debugger; }
                            mediate();
                        }).catch(home.View.rejectHandler);
                    }


                    $card.find('img.pick-birth-date').on('click', popupBirthDatePicker);

                    let editingTask = false;
                    let $col = $card.find('[data-action=editTask]');
                    RT.jQuery.setupHoverClass($col.parent())
                    $col.on('click', function () {
                        if( editingTask === false ){
                            editingTask = true;
                            let $card = $(this);
                            let expatTaskId = 0;
                            if(model.smallScreen){
                                expatTaskId = $card.data("xt");
                            }else{
                                expatTaskId = $card.parent().data("xt");
                            }
                            if (!_.isInteger(expatTaskId) || expatTaskId < 1) {
                                throw new Error("data-xt");
                            }

                            RT.jQuery.get({
                                url: home.Route.sfTaskTodo + expatTaskId,
                                contentType: false,
                                dataType: "json"
                            }).then(function (rs) {

                                let expatTask = rs.data.tasksTodo[0];
                                let expat = expatTask.expat;
                                let task = model.task[expatTask.task];

                                let compact = window.matchMedia("(max-width: 800px)").matches;

                                if(expatTask.rdv_time){
                                    expatTask.rdv_time = expatTask.rdv_time.substring(0, 5);
                                    expatTask.rdv_time = toTime(expatTask.rdv_time);
                                }

                                return RT.Dialog.create({
                                    title: expat.cn,
                                    sheet: !compact,
                                    width: 800,
                                    height: 480,
                                    dismiss: txt.actionCancel,
                                    dismissSvg: images.dismissSvg,
                                    data: expatTask,
                                    actions: [{
                                        id: "update",
                                        svg : images.update,
                                        label: txt[compact ? "actionAccept" : "actionUpdate"]
                                    }, {
                                        id: "done",
                                        svg : images.taskDone,
                                        label: txt[compact ? "actionTaskDoneAbbrev" : "actionTaskDone"]
                                    }, {
                                        id: "na",
                                        svg : images.taskNA,
                                        label: txt[compact ? "actionTaskNAAbbrev" : "actionTaskNA"]
                                    }],
                                    content: function () {
                                        return tpl.popup({
                                            cachedMoment: cachedMoment,
                                            compact: compact,
                                            route: home.Route,
                                            expatTask: expatTask,
                                            expat: expat,
                                            images: images,
                                            task: task,
                                            txt: txt,
                                            fmt: fmt
                                        });
                                    },
                                    focusSelector: function () {
                                        return "#todo-remarks";
                                    },
                                    onDisplay: function ($pane, fnDismiss) {

                                        $pane.find('button#view').on('click', function () {
                                            fnDismiss(null, "view");
                                        });
                                        $pane.find('button#mail').on('click', function () {
                                            fnDismiss(null, "mail");
                                        });

                                        let $remarks = $('#todo-remarks');
                                        RT.jQuery.selectOnFocus($remarks);
                                        RT.jQuery.trimOnBlur($remarks);

                                        let $rdv_date = $('#todo-rdv_date')
                                            .on('blur change', RT.jQuery.forceDateFormat)
                                            .on('blur change', function () {
                                                var dv = RT.jQuery.dateValue($rdv_date);
                                                if (dv && fmt.ISO8601.re.date.test(dv)) {
                                                    $rdv_date.data("memo", dv);
                                                }
                                                else {
                                                    dv = $rdv_date.data("memo");
                                                    if (dv && fmt.ISO8601.re.date.test(dv)) {
                                                        $rdv_date.val(cachedMoment(dv).format("L"));
                                                    }
                                                }
                                            });
                                        if (expatTask.rdv_date) {
                                            $rdv_date.data("memo", expatTask.rdv_date);
                                        }

                                        let $rdv_time = $('#todo-rdv_time');
                                        if (expatTask.rdv_time) {
                                            $rdv_time.val(expatTask.rdv_time);
                                        }

                                        $rdv_time.on('blur change', function () {
                                            let v1 = this.value.trim();
                                            let v2 = v1 ? toTime(v1) : null;
                                            if (v1 && v2 && v1 !== v2) {
                                                this.value = v2;
                                            }
                                        });

                                        var $rdvDatePicker = $pane.find('img.rdv_date');
                                        $rdvDatePicker.on('click', function () {
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
                                                        dnm = model.moment.today;
                                                    }
                                                    return dnm;
                                                },
                                                navigable: function (m/*, offset*/) {
                                                    return true;
                                                },
                                                selectable: function (m/*, mInitial*/) {
                                                    return true;
                                                }
                                            }).then(function (result) {
                                                if (moment.isMoment(result)) {
                                                    $rdv_date.data("memo", fmt.ISO8601.format(result));
                                                    if (!$rdv_time.val()) $rdv_time.val(result.format("HH:mm:ss"));
                                                }
                                                else {
                                                    var memo = $rdv_date.data("memo");
                                                    if (memo && fmt.ISO8601.re.date.test(memo)) {
                                                        $rdv_date.val(cachedMoment(memo).format("L"));
                                                    }
                                                }
                                            }).catch(home.View.rejectHandler);
                                        });

                                        var $deadline = $('#todo-deadline')
                                            .on('blur change', RT.jQuery.forceDateFormat)
                                            .on('blur change', function () {
                                                var dv = RT.jQuery.dateValue($deadline);
                                                if (dv && fmt.ISO8601.re.date.test(dv)) {
                                                    $deadline.data("memo", dv);
                                                }
                                                else {
                                                    dv = $deadline.data("memo");
                                                    if (dv && fmt.ISO8601.re.date.test(dv)) {
                                                        $deadline.val(cachedMoment(dv).format("L"));
                                                    }
                                                }
                                            });
                                        if (expatTask.deadline) {
                                            $deadline.data("memo", expatTask.deadline);
                                        }

                                        var $deadlinePicker = $pane.find('img.todo-deadline');
                                        $deadlinePicker.on('click', function () {
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
                                                        dnm = model.moment.today;
                                                    }
                                                    return dnm;
                                                },
                                                navigable: function (m/*, offset*/) {
                                                    return true;
                                                },
                                                selectable: function (m/*, mInitial*/) {
                                                    return true;
                                                }
                                            }).then(function (result) {
                                                if (moment.isMoment(result)) {
                                                    $deadline.data("memo", fmt.ISO8601.format(result));
                                                }
                                                else {
                                                    var memo = $deadline.data("memo");
                                                    if (memo && fmt.ISO8601.re.date.test(memo)) {
                                                        $deadline.val(cachedMoment(memo).format("L"));
                                                    }
                                                }
                                            }).catch(home.View.rejectHandler);
                                        });
                                    },
                                    onResolve: function ($pane, id) {
                                        if (["update", "view", "mail", "done", "na"].indexOf(id) >= 0) {
                                            let rq = {
                                                action: id,
                                                remarks: $('#todo-remarks').val().trim(),
                                                deadline: RT.jQuery.dateValue($('#todo-deadline')),
                                                visit: this.data.visit,
                                                rdvdate: RT.jQuery.dateValue($('#rdv_date')),
                                                rdvtime: $('#todo-rdv_time').val(),
                                                updateRemarks: true
                                            };
                                            debugger;
                                            if (!rq.deadline) {
                                                delete rq.deadline;
                                            }
                                            if (rq.action === "view") {
                                                rq.action = "update";
                                                rq.goView = true;
                                            }
                                            if (rq.action === "mail") {
                                                rq.action = "update";
                                                rq.goMail = true;
                                            }
                                            return rq;
                                        }

                                        return id;
                                    }
                                });
                            }).then(function (result) {
                                if (_.isObject(result) && result.action) {
                                    editingTask = false;
                                    return RT.jQuery.post({
                                        url: home.Route.sfTaskTodo + expatTaskId,
                                        data: JSON.stringify(result),
                                        contentType: "application/json",
                                        dataType: false
                                    }).then(function (rs) {
                                        if (rs.statusCode !== 205) { // RESET_CONTENT
                                            console.warn("unexpected response update result: %O", rs.statusCode);
                                            throw new Error("HTTP " + rs.statusCode);
                                        }
                                        return result;
                                    });
                                }
                                return result;
                            }).then(function (result) {

                                var taskTodo = _.find(model.tasksTodo, function (x) {
                                    return x.id === expatTaskId;
                                });

                                if (result.goView && taskTodo) {
                                    home.Router.go(["sfExpatView", taskTodo.expat.id]);
                                }
                                else if (result.goMail && taskTodo) {
                                    home.Router.go(["sfMailItem", taskTodo.outboxmailId]);
                                } else {
                                    home.Router.update();
                                }
                            }).catch(function (fault) {
                                console.error("expat_task(%s): dialog fault", expatTaskId, fault);
                                home.View.warn = true;
                                setTimeout(function () {
                                    home.View.warn = false;
                                    home.Router.update();
                                }, 2000);
                            });

                        }
                        else{alert('Doubleclick')}
                    });

                    function updateForm(evt) {
                        if (!$update.hasClass("disabled")) {
                            $update.addClass('disabled');
                            debugger;
                            let canSubmit = true;
                            let canUpdate = controls.SIN.val() != 0 ;
                            let mandatoryList = [
                                {
                                    name:'paperless',
                                    value: dataChoices.paperlessStatus!=null,
                                    icon: $card.find('.paperlessMissingIcon')
                                }
                            ];
                            if(canUpdate){
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
                                    sn: controls.sn.val(),
                                    gn: controls.gn.val(),
                                    birthDate: RT.jQuery.dateValue(controls.birthDate),
                                    expatFileLoadDate: RT.jQuery.dateValue(controls.expatFileLoadDate),
                                    temporaryNumberReceptionDate: RT.jQuery.dateValue(controls.temporaryNumberReceptionDate),
                                    lastActionDate: RT.jQuery.dateValue(controls.lastActionDate),
                                    spouseBirthDate: RT.jQuery.dateValue(controls.spouseBirthDate),
                                    addressFinal: controls.addressFinal.val(),
                                    iban: controls.iban.val(),
                                    SIN: controls.SIN.val(),
                                    spouseSIN: controls.spouseSIN.val(),
                                    ameliAuthSpouse: controls.ameliAuthSpouse.val(),
                                    ameliAuth: controls.ameliAuth.val(),
                                    expatAmeliMail: controls.expatAmeliMail.val(),
                                    spouseAmeliMail: controls.spouseAmeliMail.val(),
                                    socialSecurityRemark: controls.socialSecurityRemark.val(),
                                    socialSecurityFamilyRemark: controls.socialSecurityFamilyRemark.val(),
                                    isSensitive: controls.isSensitive[0].checked,
                                    isWaitingForExpat: controls.isWaitingForExpat[0].checked,
                                    isWaitingForCpam: controls.isWaitingForCpam[0].checked,
                                    familyMembers: [],
                                    removedFamilyMemberIds: model.removedFamilyMemberIds,
                                    tasks: [],
                                    spouseExists: model.expat.spouseExists,
                                    spouseSn: controls.spouseSn.val(),
                                    spouseGn: controls.spouseGn.val(),
                                    spouseId: model.expat.spouse.id,
                                    paperlessStatus: dataChoices.paperlessStatus
                                };
                                _.each(controls.tasks, function (it) {
                                    let item = {
                                        id: it.id,
                                        remarks: it.remarks.val(),
                                        deadline: RT.jQuery.dateValue(it.deadline),
                                    }
                                    rq.tasks.push(item);
                                });

                                $card.find('.family-member').each(function () {
                                    let $fm = $(this);
                                    let fm = toFamilyMember($fm);
                                    if (isValidFamilyMember(fm)) {
                                        rq.familyMembers.push(fm);
                                    }
                                });

                                RT.jQuery.put({
                                    url: home.Route.sfExpatSocialSecurity + model.expatId,
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
                        }
                        return RT.jQuery.cancelEvent(evt);
                    };

                    $update.on('click', updateForm)

                }).catch(home.View.rejectHandler);
            }
        };

    })