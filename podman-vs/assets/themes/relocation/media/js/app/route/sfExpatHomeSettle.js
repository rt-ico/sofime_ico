 define(
    ['app/home', 'app/RT', 'app/datePicker', 'jquery', 'lodash', 'moment', 'app/route/documents/DocumentsUploadDialog'],
    function (home, RT,datePicker, $, _, moment, DocumentsUploadDialog) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        var cachedMoment = RT.Time.createMomentCache();
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
                    card: "sfExpatHomeSettle"
                };

                let images = {
                    expand: "ux-circle-down.svg",
                    missing: "sign_warning.svg"
                };

                var model = {
                    expatId: _.toInteger(path[1]),
                    expat: null,
                    get locked() {
                        return !(home.User.profile === "SF" || home.User.profile === "CT");
                    },
                    fields: null,
                    supplier: null,
                    rerouted: false,
                    tt: {
                        get energyClasses() {
                            let dataset = _.values(model.energyClasses).sort(function (a, b) {
                                let x = home.Locale.compare(a.label, b.label);
                                return x === 0 ? a.id - b.id : x;
                            });
                            return dataset;
                        },
                        get rentGuarantees() {
                            let dataset = _.values(model.rentGuarantees).sort(function (a, b) {
                                let x = home.Locale.compare(a.label, b.label);
                                return x === 0 ? a.id - b.id : x;
                            });
                            return dataset;
                        }
                    },

                };

                if (path.length !== 2 || !_.isSafeInteger(model.expatId) || model.expatId <= 0) {
                    home.View.warn = true;
                    home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
                    return;
                }

                let dataChoices = {
                    homeSearchSupplier: null,
                    energyClass: null,
                    rentGuarantee: null
                };

                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.sfExpatHomeSettle + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            function bindGetName(o) {
                                o.getName = function () {
                                    return this.localeName || this.name;
                                };
                                o.getName = o.getName.bind(o);
                            }

                            model.fields = rs.data.fields;

                            model.supplier = _.chain(_.values(rs.data.supplier))
                                .each(bindGetName)
                                .value().sort(sortLocalized);
                            model.energyClasses = rs.data.energyClasses;
                            model.rentGuarantees = rs.data.rentGuarantees;
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfExpat + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.expat = result.data.expat;
                            dataChoices.energyClass = model.expat.energyClass;
                            if (!_.isObject(model.expat) || !model.expat.id || !model.expat.cn) {
                                throw new Error("expat(" + model.expatId + "): unexpected response");
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
                    home.View.documentTitle = model.expat.cn + " | " + txt.sfExpatHomeSettle;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));


                    let $card = home.View.Pane.content.find('div.card').eq(0);

                    let controls = {
                        restyled: RT.jQuery.restyleInputs($card),
                        homeSearchSupplier: model.fields.homeSearchService ? $card.find('#sfhs_homeSearchSupplier').eq(0) : null,
                        addressFinal: $card.find('#sfhs_addressfinal'),
                        floor: $card.find('#sfhs_floor'),
                        settlingDate: $card.find('#arrivalDate'),
                        digicode1: $card.find('#sfhs_digicode1'),
                        digicode2: $card.find('#sfhs_digicode2'),
                        surface: $card.find('#sfhs_surface'),
                        insurance: $card.find('#sfhs_insurance'),
                        electricity: $card.find('#sfhs_electricity'),
                        gasContract: $card.find('#sfhs_gascontract'),
                        internet: $card.find('#sfhs_internet'),
                        furnished: $card.find('#sfhs_furnished'),
                        unfurnished: $card.find('#sfhs_unfurnished'),
                        horsMarche: $card.find('#horsMarche'),
                        rentTypeCodeCivil: $card.find('#rentTypeCodeCivil'),
                        rentTypeLoiAlur: $card.find('#rentTypeLoiAlur'),
                        rentTypeHighIncome: $card.find('#rentTypeHighIncome'),
                        rentPrice: $card.find('#sfhs_rentprice'),
                        deposit: $card.find('#sfhs_deposit'),
                        housingMgr: $card.find('#sfhs_housingmgr'),
                        remarks: $card.find('#sfhs_remarks'),
                        energyClassExpand: $card.find('.expandIcon').eq(0),
                        rentGuaranteeExpand: $card.find('.rentGuaranteeExpandIcon').eq(0),
                        energyClass: $card.find('#energyClass').eq(0),
                        rentGuarantee: $card.find('#rentGuarantee').eq(0),
                        commuteTime: $card.find('#commuteTime'),
                        publicTransportationAt15: $card.find('#publicTransportationAt15'),
                        pmrAccess: $card.find('#PMRAccess'),
                        bikePoint: $card.find('#bikePoint'),

                    };
                    controls.energyClass = home.jQuery.createTypeAhead(controls.energyClass, {
                        name: "energyClass",
                        identityKey: "id",
                        displayKey: "name",
                        normalize: true,
                        limit: 200,
                        minLength: 0,
                        source: _.constant(model.tt.energyClasses),
                        onOpen: function() {
                            home.jQuery.setTypeAheadValue(controls.energyClass, '');
                        },
                        onSelect: function (v) {
                            if (v && v.id) {
                                dataChoices.energyClass = v.id;
                                mediate();
                            }
                            else {
                                dataChoices.energyClass = null;
                            }

                            //controls.energyClass.blur();
                        }
                    });
                    controls.rentGuarantee = home.jQuery.createTypeAhead(controls.rentGuarantee, {
                        name: "rentGuarantee",
                        identityKey: "id",
                        displayKey: "name",
                        normalize: true,
                        limit: 200,
                        minLength: 0,
                        source: _.constant(model.tt.rentGuarantees),
                        onOpen: function() {
                            home.jQuery.setTypeAheadValue(controls.rentGuarantee, '');
                        },
                        onSelect: function (v) {
                            if (v && v.id) {
                                dataChoices.rentGuarantee = v.id;
                                mediate();
                            }
                            else {
                                dataChoices.rentGuarantee = null;
                            }

                            //controls.energyClass.blur();
                        }
                    });
                    home.jQuery.setTypeAheadValue(controls.rentGuarantee,model.expat.refRentGuarantee ? model.rentGuarantees[model.expat.refRentGuarantee]:' ');

                    if(model.expat.refRentGuarantee) dataChoices.rentGuarantee = model.expat.refRentGuarantee;



                    (function () {
                        let p = controls.energyClass;
                        let x = controls.energyClassExpand;
                        RT.jQuery.selectOnFocus(p.selector);
                        x.on('click',function (){
                            p.selector.focus();
                        })

                    })();

                    (function () {
                        let p = controls.rentGuarantee;
                        let x = controls.rentGuaranteeExpand;
                        RT.jQuery.selectOnFocus(p.selector);
                        x.on('click',function (){
                            p.selector.focus();
                        })

                    })();

                    let $update = $card.find('.footer a.update').eq(0);
                    let $labelForMandatory = $card.find('.ifMandatory');
                    let $labelForNotMandatory = $card.find('.ifNotMandatory');



                    let mediate = function () {
                        let canSubmit = true;
                        let hasSettlingDate = RT.jQuery.dateValue(controls.settlingDate) != 0 ;

                        canSubmit = !hasSettlingDate ||
                            ( dataChoices.energyClass != null && controls.commuteTime.val().trim() || null );
                        RT.jQuery.withClassIf($labelForMandatory,'visibilityOff', !hasSettlingDate );
                        RT.jQuery.withClassIf($labelForNotMandatory,'visibilityOff', hasSettlingDate );
                        RT.jQuery.withClassIf($update, "disabled", false);

                    };
                    mediate();

                    //controls.commuteTime.on('change',mediate);
                    $card.find('input').on('change',mediate);

                    //controls.commuteTime.on('change',alert('trigger'));

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
                            //mediate();
                        }).catch(home.View.rejectHandler);
                    }
                    $card.find('img.pick-birth-date').on('click', popupDatePicker);

                    if (!model.locked) {
                        if (model.fields.homeSearchService) {
                            controls.homeSearchSupplier = home.jQuery.createTypeAhead(controls.homeSearchSupplier, {
                                name: "homeSearchSupplier",
                                identityKey: "id",
                                displayKey: "getName",
                                normalize: true,
                                limit: 200,
                                minLength: 0,
                                source: _.constant(model.supplier),
                                onSelect: function (v) {
                                    if (v && v.id) {
                                        dataChoices.homeSearchSupplier = v.id;
                                    }
                                    else {
                                        dataChoices.homeSearchSupplier = null;
                                    }
                                }
                            });
                        }
                    }

                    (function () {
                        let $dcm = controls.surface.add(controls.rentPrice).add(controls.deposit);
                        let $txt = $dcm.add(controls.addressFinal).add(controls.floor).add(controls.digicode1).add(controls.digicode2).add(controls.insurance).add(controls.electricity).add(controls.gasContract).add(controls.internet).add(controls.housingMgr).add(controls.remarks);
                        let $selectOnFocus = $txt;
                        if (controls.homeSearchSupplier) {
                            $selectOnFocus = $selectOnFocus.add(model.locked ? controls.homeSearchSupplier : controls.homeSearchSupplier.selector)
                        }
                        RT.jQuery.selectOnFocus($selectOnFocus);

                        if (!model.locked) {
                            RT.jQuery.trimOnBlur($txt);
                            $dcm.on('blur change',RT.jQuery.forceDecimalFormat);

                            $card.find('a.update').eq(0)
                                .on('click', function (evt) {
                                    debugger;
                                    console.log('clicked');
                                    evt.stopPropagation();
                                    let $a = $(this);
                                    if (!$a.hasClass('disabled')) {
                                        $a.addClass('disabled');
                                        let canSubmit = true;
                                        let hasSettlingDate = RT.jQuery.dateValue(controls.settlingDate) != 0 ;
                                        let mandatoryList = [
                                            {
                                                name:'energyClass',
                                                value:dataChoices.energyClass!=null,
                                                icon: $card.find('.energyClassMissingIcon')
                                            },
                                            {
                                                name:'commuteTime',
                                                value:controls.commuteTime.val().trim() || null,
                                                icon: $card.find('.commuteTimeMissingIcon')
                                            }
                                        ];
                                        if(hasSettlingDate){
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
                                            let conflict = false;
                                            Promise.all([
                                                RT.jQuery.get({
                                                    url: home.Route.sfExpatHomeSettle + model.expatId,
                                                    contentType: false,
                                                    dataType: "json"
                                                }).then(function (rs) {
                                                    conflict = !(_.isEqual(rs.data.fields, model.fields));
                                                    if (conflict) {
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
                                                        }).then(function () {
                                                        })
                                                    } else {
                                                        let rq = _.assign({
                                                            surface: RT.jQuery.decimalValue(controls.surface),
                                                            rentPrice: RT.jQuery.decimalValue(controls.rentPrice),
                                                            deposit: RT.jQuery.decimalValue(controls.deposit),
                                                            addressFinal: controls.addressFinal.val().trim() || null,
                                                            housingMgr: controls.housingMgr.val().trim() || null,
                                                            floor: controls.floor.val().trim() || null,
                                                            //homeSearchSupplier: controls.homeSearchSupplier.val().trim() || null,
                                                            settlingDate: RT.jQuery.dateValue(controls.settlingDate),
                                                            digicode1: controls.digicode1.val().trim() || null,
                                                            digicode2: controls.digicode2.val().trim() || null,
                                                            furnished: controls.furnished.is(':checked'),
                                                            unfurnished: controls.unfurnished.is(':checked'),
                                                            horsMarche: controls.horsMarche.is(':checked'),
                                                            rentTypeCodeCivil: controls.rentTypeCodeCivil.is(':checked'),
                                                            rentTypeLoiAlur: controls.rentTypeLoiAlur.is(':checked'),
                                                            rentTypeHighIncome: controls.rentTypeHighIncome.is(':checked'),
                                                            internet: controls.internet.val().trim() || null,
                                                            insurance: controls.insurance.val().trim() || null,
                                                            electricity: controls.electricity.val().trim() || null,
                                                            gasContract: controls.gasContract.val().trim() || null,
                                                            remarks: controls.remarks.val().trim() || null,
                                                            publicTransportationAt15: controls.publicTransportationAt15.is(':checked'),
                                                            pmrAccess: controls.pmrAccess.is(':checked'),
                                                            bikePoint: controls.bikePoint.is(':checked'),
                                                            commuteTime: controls.commuteTime.val().trim() || null,
                                                            energyClass: dataChoices.energyClass ? dataChoices.energyClass.id : null,
                                                            rentGuarantee: dataChoices.rentGuarantee ? dataChoices.rentGuarantee.id : null,
                                                        }, dataChoices);
                                                        RT.jQuery.put({
                                                            url: home.Route.sfExpatHomeSettle + model.expatId,
                                                            data: JSON.stringify(rq),
                                                            contentType: "application/json",
                                                            dataType: false
                                                        }).then(function (rs) {
                                                            return new Promise(function (resolve, reject) {
                                                                if (rs.statusCode === 205) {
                                                                    console.log("updated");
                                                                    location.reload();
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
                                            return RT.jQuery.cancelEvent(evt);
                                        }
                                        else{
                                            RT.Popup.create({
                                                title: txt.missingFields,
                                                subtitle: txt.missingFieldsTitle,
                                                top: evt.clientY - 8,
                                                left: evt.clientX - 8,
                                                width: 0,
                                                height: 0,
                                                items: [{
                                                    id: "ok",
                                                    label: txt.dialogWriteConflictOk
                                                }]
                                            })
                                        }
                                        return RT.jQuery.cancelEvent(evt);
                                    }

                                });
                        }

                        let requestingReport = false;
                        $card.find('[data-action="generateReport"]').click(function (evt) {
                            evt.stopPropagation();
                            if(!$(this).hasClass('disabled')){
                                $(this).addClass('disabled');
                            }
                            let smallScreen = window.matchMedia("(max-width: 420px)").matches;
                            if(!requestingReport){
                                requestingReport = true;
                                new RT.Popup.create({
                                    title: txt.dialogConfirmGenerateReport,
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
                                                RT.jQuery.put({
                                                    url: home.Route.requestReport + model.expatId,
                                                    dataType: false
                                                })
                                                break
                                            case "cancel":
                                                defaultHandler();
                                                break
                                        }
                                    }
                                })
                            }
                        });

                        let $uploadField = $card.find('.upload-document-file');
                        $uploadField.on('change', function (evt) {
                            let files = evt.originalEvent.target.files;
                            if (files.length === 1) {
                                new DocumentsUploadDialog({
                                    targetDocument : 0, /*{
                                                name : '',
                                                remarks : '',
                                                ref_type : null,
                                                ref_expat : model.expatId,
                                                required: false,
												replace : null
                                            },*/
                                    refExpat : model.expatId,
                                    model : {
                                        fullDocs : model.documents.files,
                                        document_type : model.documents.document_type,
                                        thumb: home.Image.Thumb.a4portrait,
                                        findDocumentTypeById : function (id) {
                                            if (!id) return id;
                                            return _.find(model.document_type, function (p) {
                                                return p.id === id;
                                            });
                                        },
                                        findDocumentById : function (id) {
                                            if (!id) return id;
                                            return _.find(model.fullDocs, function (p) {
                                                return p.id === id;
                                            });
                                        }
                                    },
                                    jst : ctx.jst,
                                    files : files,
                                    refresh : true
                                });
                            }
                        });

                        $card.find('a.upload').eq(0).click(function (evt) {
                            evt.stopPropagation();

                            RT.jQuery.get({
                                url: home.Route.expatsStaffDocuments + '0/' + model.expatId ,
                                contentType: false,
                                dataType: "json"
                            }).then(function (result) {
                                model.documents = result.data;

                            });
                            console.log('upload click');
                            $uploadField.click();
                        });


                        if (controls.homeSearchSupplier) {
                            let homeSearchSupplier = findById(model.fields.homeSearchSupplier, model.supplier);
                            if (homeSearchSupplier) {
                                if (model.locked) {
                                    controls.homeSearchSupplier.val(homeSearchSupplier.getName());
                                }
                                else {
                                    home.jQuery.setTypeAheadValue(controls.homeSearchSupplier, homeSearchSupplier);
                                    dataChoices.homeSearchSupplier = homeSearchSupplier.id;
                                }
                            }
                        }
                    })();

                    RT.jQuery.setupHoverClass($card.find('.footer a.accent-ghost'));

                }).catch(home.View.rejectHandler);
            }
        };
    }
);