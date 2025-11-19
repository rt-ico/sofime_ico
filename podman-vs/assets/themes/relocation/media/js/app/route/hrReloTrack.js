define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'app/route/documents/Documents'],
    function (home, RT, $, _, moment, Documents) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        var cachedMoment = RT.Time.createMomentCache();

        function toLocationText(location) {
            var lbl = "";
            if (_.isObject(location)) {
                if (location.address) {
                    lbl += _.escape(location.address);
                    if (location.postCode || location.city) lbl += ", ";
                }
                if (location.postCode) {
                    lbl += _.escape(location.postCode);
                }
                if (location.city) {
                    if (location.postCode) lbl += " ";
                    lbl += _.escape(location.city);
                }
            }
            return lbl;
        }

        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },
            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                if (path.length > 1 && _.toInteger(path[1]) > 0 && path[1] === oldPath[1] && path[0] === oldPath[0]) return;
                home.Profile.require("HR");
                home.View.actions = null;

                var tpl = {
					card: "hrReloTrack",
					minicards: "hrReloTrackMinicards"
                };
                var images = {
                    expand: "ux-circle-down.svg",
                    contract: "ux-circle-up.svg",
                    folder: "ux-folder.svg",
                    printer: "ux-printer.svg",
                    trash: "ux-trash.svg",
                    zoomIn: "ux-zoom-in.svg",
                    triangle: "shape_triangle.svg"
                };
                var model = {
                    moment: {
                        today: moment().startOf("day")
                    },
                    expats: null,
                    expatId: null,
                    expat: null,
                    welcomer: null,
                    relocations: null,
                    clients: null,
                    service: null,
                    country: null,
                    callCode: null,
                    familyRelation: null,
                    showCurrent: false,
                    showDone: false,
                    sortDone: {
                        asc: null,
                        att: null
                    },
                    rerouted: false
                };

                if (path.length === 1) {
                    model.showCurrent = true;
                }
                else if (path.length >= 2 && path[1] === "done") {
                    model.showDone = true;
                    tpl.card = "hrReloTrackDone";

                    model.sortDone.asc = "asc" === path[2] ? true : "desc" === path[2] ? false : null;
                    model.sortDone.att = path[3];
                    if (["cn", "arrival"].indexOf(model.sortDone.att) < 0) model.sortDone.att = null;

                    if (model.sortDone.asc === null || model.sortDone.att === null) {
                        model.rerouted = true;
                        home.Router.go([path[0], path[1], model.sortDone.asc === "desc" ? "desc" : "asc", model.sortDone.att || "cn"]);
                        return;
                    }
                }
                else if (path.length >= 2 && /^[0-9]+$/.test(path[1])) {
                    model.expatId = parseInt(path[1], 10);
                    if (_.isSafeInteger(model.expatId) && model.expatId > 0) {
                        tpl.card = "hrReloTrackExpat";
                    }
                    else {
                        model.expatId = null;
                    }
                }

                if (!(model.showCurrent || model.showDone || model.expatId)) {
                    model.rerouted = true;
                    home.Router.go([path[0]]);
                    return;
                }

                var deferred = [RT.jQuery.get({
                    url: home.Route.masterData,
                    contentType: false,
                    dataType: "json"
                }).then(function (rs) {
                    model.service = rs.data.service;
                    model.country = rs.data.country;
                    model.callCode = rs.data.callCode;
                    model.familyRelation = rs.data.familyRelation;
                })];

                if (model.expatId !== null) {
                    deferred.push(RT.jQuery.get({
                        url: home.Route.activeExpatVisit + "-/" + model.expatId,
                        contentType: false,
                        dataType: "json"
                    }).then(function (result) {
                        _.each(result.data.visits, function (p) {
                            if (p.places.length > 0) {
                                model.hasVisits = true;
                            }
                        });
                    }));
                }

                if (model.showCurrent || model.showDone) {
                    deferred.push(RT.jQuery.get({
                        url: home.Route.reloTrack + (model.expatId || (model.showDone ? "done" : "current")),
                        contentType: false,
                        dataType: "json"
                    }).then(function (rs) {
                        if (!_.isObject(rs.data.clients)) {
                            console.warn("unexpected response : %O", rs.data);
                            throw new Error("unexpected response: " + rs.url);
                        }

                        model.clients = rs.data.clients;
                        model.expats = model.showDone ? _.filter(rs.data.done, function (x) {
                            return !!x.arrival;
                        }) : rs.data.current;
                        _.each(model.expats, function (x) {
                            if (x.client) x.client = model.clients[x.client];
                        });

                        if (model.showDone) {
                            model.expats.sort(function (a, b) {
                                var x = 0;
                                if (model.sortDone.att === "arrival") {
                                    x = (a.arrival ? 0 : 1) - (b.arrival ? 0 : 1);
                                    if (!x && a.arrival && b.arrival) {
                                        x = a.arrival < b.arrival ? -1 : a.arrival > b.arrival ? 1 : 0;
                                    }
                                }
                                if (!x) x = home.Locale.compare(a.sn, b.sn);
                                if (!x) x = home.Locale.compare(a.gn, b.gn);
                                return model.sortDone.asc ? x : x * -1;
                            });
                        }
                        else {
                            model.expats.sort(function (a, b) {
                                // undefined arrival => end of list
                                var x = (a.arrival ? 0 : 1) - (b.arrival ? 0 : 1);
                                if (!x && a.arrival && b.arrival) {
                                    x = a.arrival < b.arrival ? -1 : a.arrival > b.arrival ? 1 : 0;
                                }
                                if (!x) x = home.Locale.compare(a.sn, b.sn);
                                if (!x) x = home.Locale.compare(a.gn, b.gn);
                                return x !== 0 ? x : a.id - b.id;
                            });
                        }
                    }));
                }
                else if (_.isSafeInteger(model.expatId) && model.expatId > 0) {
                    deferred.push(RT.jQuery.get({
                        url: home.Route.reloTrack + model.expatId,
                        contentType: false,
                        dataType: "json"
                    }).then(function (rs) {
                        model.expat = rs.data.expat;
                        if (_.isObject(rs.data.welcomer)) {
                            model.welcomer = rs.data.welcomer;
                        }
                        model.relocations = _.sortBy(rs.data.relocations, "cn");
                    }));
                    deferred.push(RT.jQuery.get({
                        url: home.Route.serviceStatus + model.expatId,
                        contentType: false,
                        dataType: "json"
                    }).then(function (rs) {
                        model.status = rs.data;
                    }));

                }

                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all(deferred)
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
                        cachedMoment: cachedMoment,
                        toLocationText: toLocationText,
                        images: images,
						tpl: tpl,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    var $card = home.View.Pane.content.find('div.card').eq(0);
                    $card.find('div.expats.cards .minicard[data-id], table.expats.done tr[data-id]').on('click', function () {
                        var $el = $(this);
                        var id = $el.data("id");
                        if (_.isSafeInteger(id) && id > 0) {
                            home.Router.go([path[0], id]);
                        }
                    });
                    if (model.showDone) {
                        $card.find('th.sortable[data-col]').on('click', function () {
                            var $th = $(this);
                            var att = $th.data("col");
                            var p = path.slice(0, 2);
                            p.push(model.sortDone.asc && model.sortDone.att === att ? "desc" : "asc");
                            p.push(att);
                            home.Router.go(p);
                        });
                    }

                    if (model.expat) {
                        Promise.all([
                            RT.jQuery.get({
                                url: home.Route.expatsStaffDocuments + '0/' + model.expatId ,
                                contentType: false,
                                dataType: "json"
                            })
                        ]).then(function (result) {
                            var documents = result[0].data;

                            RT.Convert.toDate(documents.files, 'ctime');
                            RT.Convert.toDate(documents.files, 'mtime');
                            documents.files = _.orderBy(documents.files, ['name']);

                            documents.document_type = _.orderBy(documents.document_type, ['default', 'name'], ['asc', 'asc']);

                            model.documents = documents;

                            var controls = {
                                expatPicker: home.jQuery.createTypeAhead($('#pick-hr-expat'), {
                                    name: 'expats',
                                    identityKey: 'id',
                                    displayKey: 'cn',
                                    normalize: true,
                                    limit: 200,
                                    minLength: 0,
                                    source: _.constant(_.values(model.relocations)),
                                    onSelect: function (v) {
                                        if (_.isObject(v) && _.isInteger(v.id) && v.id !== model.expat.id) {
                                            home.Router.go([path[0], v.id]);
                                        }
                                    }
                                }),
                                expatExpand: $card.find('.pick-expat div.icon')
                            };

                            home.jQuery.setTypeAheadValue(controls.expatPicker, model.expat);
                            RT.jQuery.selectOnFocus(controls.expatPicker.selector);

                            controls.expatExpand.on('click', function () {
                                home.jQuery.setTypeAheadValue(controls.expatPicker, null);
                                controls.expatPicker.selector.focus();
                            });

                            $card.find('.relocation-status-card-expand').click(function (evt) {
                                evt.stopPropagation();


                                var $card = $(this).closest('.relocation-status-card');
                                if ($card.hasClass('relocation-status-card-closed')) {
                                    $card.removeClass('relocation-status-card-closed').addClass('relocation-status-card-open');
                                }
                                else {
                                    $card.removeClass('relocation-status-card-open').addClass('relocation-status-card-closed');
                                }
                            });


                            var uploadedDocs = _.filter(model.documents.files, function (p) {
                                return p.has_file;
                            });
                            new Documents(_.assign({
                                card: '.documents-pane',
                                path: path[0] + '/' + path[1],
                                menuUploadDocument: txt.expatDocumentRhUploadTitle,
                                menuBrowseDocument: txt.expatDocumentRhBrowseTitle,
                                uploadCount : uploadedDocs.length,
                                browseCount : uploadedDocs.length,
                                menu:  path[2],
                                filter: path[3],
                                document_type: model.documents.document_type,
                                refExpat: model.expatId,
                                updateRoute: home.Route.expatsStaffDocuments,
                                documentBlocks : [{
                                    title: txt.rhViewExpatDocument,
                                    viewType: 'upload',
                                    enableFilter : false,
                                    count : true,
                                    canAdd: true,
                                    canDelete: true,
                                    canPrint: true,
                                    canDownload: true,
                                    canUpload: true,
                                    canOpen: true,
                                    emptyText : null,
                                    showEmpty : true,
                                    url :  home.Route.expatsStaffDocuments + '0/' + model.expatId + '/',
                                    docs: _.filter(model.documents.files, function (p) {
                                        return !p.has_file  && p.type && p.type.isRequiredHr;
                                    })
                                }, {
                                    title: txt.expatDocumentHistory,
                                    viewType: 'upload',
                                    enableFilter: false,
                                    count: false,
                                    canAdd: false,
                                    canDelete: true,
                                    canPrint: false,
                                    canDownload: false,
                                    canOpen: true,
                                    canUpload: true,
                                    emptyText: null,
                                    showEmpty : false,
                                    url: home.Route.expatsStaffDocuments + '0/' + model.expatId + '/',
                                    docs: _.filter(model.documents.files, function (p) {
                                        return p.has_file  && p.type && p.type.isRequiredHr;
                                    })
                                }, {
                                    title: null,
                                    viewType: 'browse',
                                    count: true,
                                    enableFilter: true,
                                    canAdd: false,
                                    canDelete: false,
                                    canPrint: true,
                                    canDownload: true,
                                    canOpen: true,
                                    canUpload: false,
                                    showEmpty : false,
                                    category: [
                                        {id: "isAdmin",         text: txt.expatDocumentAdmin, selected: true},
                                        {id: "isMoving",        text: txt.expatDocumentMoving, selected: false},
                                        {id: "isImmigration",   text: txt.expatDocumentImmigration, selected: false},
                                        {id: "isHousing",       text: txt.expatDocumentHousing, selected: false},
                                        {id: "isHealth",        text: txt.expatDocumentHealth, selected: false},
                                        {id: "isInvoice",       text: txt.expatDocumentInvoice, selected: false}
                                    ],
                                    emptyText: txt.incomingDocument,
                                    url: home.Route.expatsStaffDocuments + '0/' + model.expatId + '/',
                                    docs: _.filter(model.documents.files, function (p) {
                                        var validCategory =  (p.type.isAdmin === true ||
                                            p.type.isMoving === true ||
                                            p.type.isImmigration === true ||
                                            p.type.isHousing === true ||
                                            p.type.isHealth === true ||
                                            p.type.isInvoice === true);

                                        return p.type && validCategory && p.has_file ;
                                    })
                                }]
                            }, ctx));
                        });
                        /*
                        // resets staff view of indicators; probably not helpful
                            var staffTrackViewUri = home.Route.staffView + "documents/" + model.expat.id;
                            RT.jQuery.get({
                                url: staffTrackViewUri,
                                contentType: false,
                                dataType: false
                            }).then(function (rs) {
                                console.log("viewDocuments: %s", rs.statusCode);
                            }).catch(function (fault) {
                                console.error("%s: update fault.", staffTrackViewUri, fault);
                                //home.View.warn = true;
                            });
                        */
                    }
                }).catch(home.View.rejectHandler);
            }
        };
    }
);