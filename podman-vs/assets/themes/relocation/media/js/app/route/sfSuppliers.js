define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;


        var goViewSupplierContact = function (supplierContact) {
            console.log('contact : ' + JSON.stringify(supplierContact));
            if (_.isObject(supplierContact) && supplierContact.id && supplierContact.name) {
                home.Router.go(["sfSupplierContactEdit", supplierContact.id]);
            }
            else {
                home.Router.go(["sfSupplierContactEdit", 0]);
            }
        };

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
			    console.log(path + '/' +oldPath);
                if (path[0] === oldPath[0] && path.length === oldPath.length) {
                    return;
                }

				home.View.actions = null;
				home.Profile.requireSofime();

				var tpl = {
					card: "sfSuppliers",
					supplierCards: "sfSupplierCards"
				};
                var images = {
                    add_file: "ux-square-add.svg",
                    expand: "ux-circle-down.svg",
                    phone: "ux-phone.svg"
                };
				let model = {
				    supplierContacts : null,
                    md: {
                        suppliers: {},
                        supplierTypes: {},
                        supplierFlags: [
                            ["flagElementary", "flagMiddleSchool", "flagHighSchool", "flagBilingualProgram", "flagIntlCourse", "flagKindergarden"],
                            ["flagIntlLevelA"],
                            ["flagIbDiploma"],
                            ["flagMailing"]
                        ],
                        supplierContacts: {}
                    },
                    tt: {
                        get suppliers() {
                            var dataset = _.values(model.md.suppliers);

                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.name, b.name);
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                name: _.constant(txt.colSupplier)
                            });
                            return dataset;
                        },
                        get supplierTypes() {
                            var dataset = _.values(model.md.supplierTypes);

                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.name, b.name);
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                name: _.constant(txt.colSupplierType)
                            });
                            return dataset;
                        },
                        get supplierContacts() {
                            var dataset = _.values(model.md.supplierContacts).sort(function (a, b) {
                                var x = home.Locale.compare(a.name, b.name);
                                return x === 0 ? a.id - b.id : x;
                            });
                            if (_.isInteger(model.filter.supplier)) {
                                dataset = _.filter(dataset, function (x) {
                                    return x.supplier && x.supplier.id === model.filter.supplier;
                                });
                            }
                            dataset.unshift({
                                id: 0,
                                name: txt.colSupplierContact
                            });
                            return dataset;
                        }
                    },
                    filter: {
                        supplier: path[1],
                        supplierType: path[2],
                        supplierContact: path[3],
                        supplierFlag: path[4]
                    },
                    rerouted: false
				};

                (function () {
                    var a = ["supplier", "supplierType", "supplierContact", "supplierFlag"];
                    var f = model.filter;

                    _.each(a, function (k) {
                        if (f[k] === "-") {
                            f[k] = null;
                            return; // continue
                        }
                        f[k] = (_.isString(f[k]) && f[k].length > 0) ? _.toInteger(f[k]) : null;
                        if (!_.isSafeInteger(f[k]) || f[k] < 1) {
                            f[k] = null;
                            model.rerouted = true;
                        }
                    });
                })();

                function idParam(v) {
                    return _.isInteger(v) && v > 0 ? v : "-";
                }

                var go = function (o) {
                    var f = ["supplier", "supplierType", "supplierContact", "supplierFlag"];
                    var t = _.assign(_.pick(model.filter, f), _.pick(o, f));
                    model.filter = t;
                    home.Router.go([path[0], idParam(t.supplier), idParam(t.supplierType), idParam(t.supplierContact), idParam(t.supplierFlag)]);
                };
                console.log('rerouted : ' + model.rerouted);
                if (model.rerouted) {
                    go(model.filter);
                    return;
                }

                function applyFilters() {
                    model.supplierContacts = model.supplierContactsFull;

                    if (model.filter.supplierContact) {
                        /*console.log('model.filter.supplierContacts :' + model.filter.supplierContact);*/
                        model.supplierContacts = _.filter(model.supplierContacts, function (x) {
                            return x.id === model.filter.supplierContact;
                        });
                        if (_.isEmpty(model.supplierContacts)) {
                            model.rerouted = true;
                            model.filter.supplier = null;
                            go(model.filter);
                        }
                    }
                    if (model.filter.supplierType) {
                        /*console.log('model.filter.supplierType :' + model.filter.supplierType);*/
                        model.supplierContacts = _.filter(model.supplierContacts, function (x) {
                            return x.supplier && x.supplier.type && x.supplier.type.id === model.filter.supplierType;
                        });
                    }
                    if (model.filter.supplier) {
                        /*console.log('model.filter.supplierContacts :' + model.filter.supplierContact);*/
                        model.supplierContacts = _.filter(model.supplierContacts, function (x) {
                            return x.supplier && x.supplier.id === model.filter.supplier;
                        });
                    }

                    if (model.filter.supplierFlag) {
                        var idx = 2;
                        var selectedFlagsGroup = [];
                        _.each(model.md.supplierFlags, function (flagGroup) {
                            var selectedFlags = [];
                            _.each(flagGroup, function (flag) {
                                if (model.filter.supplierFlag & idx) {
                                    selectedFlags.push(flag);
                                }
                                idx = idx << 1;
                            });
                            if (selectedFlags.length > 0) {
                                selectedFlagsGroup.push(selectedFlags);
                            }
                        });
                        console.log('selected flag :' + selectedFlagsGroup);

                        _.each(selectedFlagsGroup, function (flagGroup) {
                            model.supplierContacts = _.filter(model.supplierContacts, function (x) {
                                var selected = false;
                                _.each(flagGroup, function (flag) {
                                    selected = selected || (x.flags && x.flags[flag]);
                                });
                                return selected;
                            });
                        });
                    }
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
							model.task = rs.data.task;
						})
					]),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.supplierContact,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.suppliers = rs.data.suppliers;
                            model.supplierTypes = rs.data.supplierTypes;
                            model.supplierContacts = rs.data.supplierContacts;
                            model.supplierContactsFull = rs.data.supplierContacts;

                            model.md.suppliers = rs.data.suppliers;
                            model.md.supplierTypes = rs.data.supplierTypes;
                            model.md.supplierContacts = _.values(rs.data.supplierContacts);

                            applyFilters();
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
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
                        supplierFlags: model.md.supplierFlags,
                        flagMask : model.filter.supplierFlag,
						images: images,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

                    var controls = {
                        supplierExpand: $card.find('.icon.pick-supplier').eq(0),
                        supplierPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-supplier input.combo').eq(0), {
                            name: "supplier",
                            identityKey: "id",
                            displayKey: "name",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.suppliers),
                            onSelect: function (v) {
                                console.log('selection' + JSON.stringify(v));
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    if (v.id !== model.filter.supplier) {
                                        go({supplier: v.id});
                                        applyFilters();
                                        refreshCards();
                                    }
                                }
                                else {
                                    setTimeout(setInitial.supplier, 10);
                                }
                            }
                        }),
                        supplierTypeExpand: $card.find('.icon.pick-supplier-type').eq(0),
                        supplierTypePicker: home.jQuery.createTypeAhead($card.find('.combo.pick-supplier-type input.combo').eq(0), {
                            name: "supplierType",
                            identityKey: "id",
                            displayKey: "name",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.supplierTypes),
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    if (v.id !== model.filter.supplierType) {
                                        go({supplierType: v.id});
                                        applyFilters();
                                        refreshCards();
                                    }
                                }
                                else {
                                    setTimeout(setInitial.supplierType, 10);
                                }
                            }
                        }),
                        supplierContactExpand: $card.find('.icon.pick-supplier-contact').eq(0),
                        supplierContactPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-supplier-contact input.combo').eq(0), {
                            name: "supplierContact",
                            identityKey: "id",
                            displayKey: "name",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.supplierContacts),
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    if (v.id !== model.filter.supplierContact) {
                                        go({supplierContact: v.id});
                                        applyFilters();
                                        refreshCards();
                                    }
                                }
                                else {
                                    setTimeout(setInitial.supplierContact, 10);
                                }
                            }
                        })
                    };

                    $card.find('.pick-supplier-flag.icon').click(function (evt) {
                        evt.stopPropagation();

                        var $inputBox = $(this).closest('.input-flag-box');
                        console.log('before set url flag filter : ' + model.filter.supplierFlag);
                        var flagFilter = model.filter.supplierFlag ? model.filter.supplierFlag ^ 1 : 1;
                        console.log('set url flag filter : ' + model.filter.supplierFlag);
                        if ($inputBox.hasClass('flag-selection-closed')) {
                            go({supplierFlag: flagFilter});
                            $inputBox.removeClass('flag-selection-closed').addClass('flag-selection-open');
                        } else {
                            go({supplierFlag: flagFilter});
                            $inputBox.removeClass('flag-selection-open').addClass('flag-selection-closed');
                        }
                    });

                    var setInitial = {
                        supplier: function () {
                            var v = model.filter.supplier ? _.find(model.tt.suppliers, function (it) {
                                return it.id === model.filter.supplier;
                            }) : null;
                            home.jQuery.setTypeAheadValue(controls.supplierPicker, v || model.tt.suppliers[0]);
                        },
                        supplierType: function () {
                            var v = model.filter.supplierType ? _.find(model.tt.supplierTypes, function (it) {
                                return it.id === model.filter.supplierType;
                            }) : null;
                            home.jQuery.setTypeAheadValue(controls.supplierTypePicker, v || model.tt.supplierTypes[0]);
                        },
                        supplierContact: function () {
                            var v = model.filter.supplierContact ? _.find(model.tt.supplierContacts, function (it) {
                                return it.id === model.filter.supplierContact;
                            }) : null;
                            home.jQuery.setTypeAheadValue(controls.supplierContactPicker, v || model.tt.supplierContacts[0]);
                        }
                    };

                    (function () {
                        _.each(["supplier", "supplierType", "supplierContact"], function (k) {
                            setInitial[k]();
                            var p = controls[k + "Picker"];
                            var x = controls[k + "Expand"];
                            RT.jQuery.selectOnFocus(p.selector);
                            x.on('click', function () {
                                home.jQuery.setTypeAheadValue(p, null);
                                p.selector.focus();
                            });
                        });
                    })();

                    var update = function() {
                        var $input = $(this);
                        var idx = $input.data('idx');
                        var name = $input.attr('name');

                        var flagFilter = model.filter.supplierFlag ? model.filter.supplierFlag ^ idx : idx;
                        console.log('filter idx :' + idx + '/' + name);
                        go({supplierFlag: flagFilter});
                        applyFilters();
                        refreshCards();

                    };

                    (function () {
                        var $txt = $card.find('input[type="checkbox"]');

                        RT.jQuery.trimOnBlur($txt);

                        $txt.on('change', update);
                    })();

                    var refreshCards = function () {
                        var $supplierCards = $card.find('.suppliers-card');
                        $supplierCards[0].innerHTML = tpl.supplierCards(_.assign({
                            user: home.User,
                            route: home.Route,
                            supplierFlags: model.md.supplierFlags,
                            flagMask: model.filter.supplierFlag,
                            images: images,
                            txt: txt,
                            fmt: fmt
                        }, model));

//                    $supplierCards.innerHTML = "pouette";

                        var $cards = $card.find('article.contact[data-contact]');
                        RT.jQuery.restyleInputs($card);

                        var getCardSupplierContact = function ($div) {
                            var contact = $div.data("contact");
                            return contact ? _.find(model.supplierContacts, function (x) {
                                return x.id === contact;
                            }) : null;
                        };

                        $cards.on("contextmenu", function (evt) {
                            var contact = getCardSupplierContact($(this));
                            if (!contact) return RT.jQuery.cancelEvent(evt);

                            RT.Popup.create({
                                title: contact.cn,
                                top: evt.clientY - 8,
                                left: evt.clientX - 8,
                                width: 0,
                                height: 0,
                                items: [{
                                    id: "goView",
                                    label: txt.actionViewExpat
                                }]
                            }).then(function (result) {
                                if (_.isObject(result) && _.isString(result.id)) {
                                    switch (result.id) {
                                        case "goView":
                                            goViewSupplierContact(contact);
                                            break;
                                    }
                                }
                                return result;
                            });

                            return RT.jQuery.cancelEvent(evt);
                        });

                        RT.jQuery.setupHoverClass($cards).on('click', function () {
                            goViewSupplierContact(getCardSupplierContact($(this)));
                        });
                    };
                    refreshCards();
				}).catch(home.View.rejectHandler);
			}
		};
	}
);