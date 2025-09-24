define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
    function (home, RT, $, _, moment) {
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
                if (sameRoute && path.length > 0 && path[1] === oldPath[1]) return;
                home.View.actions = null;
                home.Profile.requireSofime();

                var tpl = {
                    card: "sfSupplierContactEdit"
                };
                var images = {
                    add: "ux-add.svg",
                    remove: "ux-trash.svg"
                };
                var model = {
                    supplierId: _.toInteger(path[1]),
                    rerouted: false,
                    supplier: null
                };
                var dataChoices = {
                    supplier: null
                };

                if (path.length !== 2 || !_.isSafeInteger(model.supplierId) || model.supplierId <= -1) {
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


                        }),
                        RT.jQuery.get({
                            url: home.Route.supplierContact + model.supplierId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.suppliers = result.data.suppliers;
                            _.each(model.supplier, function(it){
                                it.accented = false;
                            })
                            model.supplierTypes = result.data.supplierTypes;
                            model.supplierContact = result.data.supplierContact;
                            if (model.supplierId === 0) {
                                model.supplierContact = {
                                    id : 0
                                };
                            } else {
                                if (!_.isObject(model.supplierContact) || !model.supplierContact.id || !model.supplierContact.name) {
                                    throw new Error("supplier(" + model.supplierId + "): unexpected response");
                                }
                                if (model.supplierContact.supplier && _.isInteger(model.supplierContact.supplier.id)) {
                                    dataChoices.supplier = model.supplierContact.supplier.id;
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

                    let flagGroup = [
                        ["flagElementary", "flagMiddleSchool", "flagHighSchool", "flagBilingualProgram", "flagIntlCourse"],
                        ["flagKindergarden"],
                        ["flagIntlLevelA"],
                        ["flagIbDiploma"],
                        ["flagMailing"]
                    ];

                    home.View.warn = false;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        images: images,
                        flagGroup : flagGroup,
                        txt: txt,
                        fmt: fmt
                    }, model));
                    var $card = home.View.Pane.content.find('div.card').eq(0);
                    var $supplierCard = $card.find('.supplier').eq(0);
                    var $supplierLabelCard = $card.find('.supplier-type-label').eq(0);

                    var $update = $card.find('.footer a.update').eq(0);

                    var controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        name: $card.find('input[name="name"]'),
                        tel: $card.find('input[name="tel"]'),
                        email: $card.find('input[name="email"]'),
                        supplierName: $card.find('input[name="supplierName"]'),
                        supplierTypeLabel: $card.find('input[name="supplierTypeLabel"]'),
                        remarks: $('#expat-remarks'),
                        supplier: home.jQuery.createTypeAheadWithAccent($card.find('input[type="text"][name="supplier"]'), {
                            name: 'supplier',
                            identityKey: 'id',
                            displayKey: 'name',
                            accentKey: 'accented',
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(_.values(_.assign({ "0" : {
                                    id : 0,
                                    name : txt.sfSupplierAdd,
                                    accented : true
                                }}, model.suppliers))),
                            onSelect: function (v) {
                                dataChoices.supplier = v ? v.id : null;
                                if (dataChoices.supplier === 0) {
                                    $supplierCard.show();
                                    $supplierLabelCard.hide()
                                } else {
                                    $supplierCard.hide();
                                    $supplierLabelCard.show();
                                    var supplierType = model.supplierTypes[v.type];
                                    console.log(JSON.stringify(supplierType));
                                    controls.supplierTypeLabel.val(supplierType.name);
                                }

                                mediate();
                            }
                        }),
                        supplierType: home.jQuery.createTypeAhead($card.find('input[type="text"][name="supplierType"]'), {
                            name: 'supplierType',
                            identityKey: 'id',
                            displayKey: 'name',
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(_.values(model.supplierTypes)),
                            onSelect: function (v) {
                                dataChoices.supplierType = v ? v.id : null;

                                mediate();
                            }
                        })
                    };
                    $

                    $supplierCard.hide();

                    //add flag
                    _.each(flagGroup, function (group) {
                        _.each(group, function (field) {
                            controls[field] = $card.find('input[name="'+field+'"]');
                        });
                    });

                    if (model.suppliers) {
                        home.jQuery.setTypeAheadValue(controls.supplier, model.supplierContact.supplier);
                        if (model.supplierContact.supplier && model.supplierContact.supplier.type) {
                            controls.supplierTypeLabel.val(model.supplierContact.supplier.type.name);
                        }
                    }


                    RT.jQuery.trimOnBlur(controls.name.add(controls.name)
                        .add(controls.name)
                        .add(controls.remarks)
                    );

                    var mediate = function () {
                        console.log('mediate');

                        var canSubmit = !!controls.name.val();
                        if (canSubmit) {
                            if (dataChoices.supplier === 0) {
                                canSubmit = (!!controls.supplierName.val() && _.isInteger(dataChoices.supplierType));
                            } else {
                                canSubmit = _.isInteger(dataChoices.supplier)
                            }
                        }

                        if (canSubmit) {
                            canSubmit = (!!controls.email.val() || !!controls.tel.val());
                        }


                        /*

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
                        }*/
                        console.log('mediate : ' + canSubmit);
                        RT.jQuery.withClassIf($update, "disabled", !canSubmit);
                    };

                    (function () {
                        $card.find('input.date').on('blur change', RT.jQuery.forceDateFormat);

                        var $txt = $card.find('input[type="text"]:not(.combo), input[type="email"], input[type="tel"], textarea, input[type="checkbox"]');

                        RT.jQuery.trimOnBlur($txt);

                        /*  controls.supplier.on('input change', function () {
                              var v1 = this.value;
                              var v2 = v1.replace(/[^0-9.+() ]/g, "");
                              if (v1 !== v2) this.value = v2;
                          });*/

                        $txt.on('change', mediate);
                    })();

                    $update.on('click', function (evt) {
                        if (!$update.hasClass("disabled")) {
                            console.log('update');
                            let telValue = function($jq) {
                                let v = $jq.val();
                                return v && _.isString(v) ? v.replace(/[^0-9.+() ]/g, "") : null;
                            };

                            let rq = {
                                name: controls.name.val(),
                                tel: telValue(controls.tel),
                                email: controls.email.val(),
                                supplier: dataChoices.supplier,
                                supplierName: controls.supplierName.val(),
                                supplierType: dataChoices.supplierType,
                                remarks: controls.remarks.val()
                            };

                            _.each(flagGroup, function (group) {
                                _.each(group, function (field) {
                                    rq[field] =  _.toInteger(controls[field][0].checked);
                                });
                            });


                            RT.jQuery.put({
                                url: home.Route.supplierContact + model.supplierId,
                                data: JSON.stringify(rq),
                                contentType: "application/json",
                                dataType: false
                            }).then(function (rs) {
                                if (model.supplierId === 0) {
                                    home.Router.go(["sfSupplierContactEdit", rs.data.supplierContact.id]);
                                    return;
                                }
                                return new Promise(function (resolve, reject) {
                                    if (rs.statusCode === 205) {
                                        console.log("account updated");
                                        RT.jQuery.withClassIf($update, "disabled", true);
                                        //location.reload();
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

                }).catch(home.View.rejectHandler);
            }
        };
    }
);