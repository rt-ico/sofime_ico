define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'app/route/documents/Documents'],
    function (home, RT, $, _, moment, Documents) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        var cachedMoment = RT.Time.createMomentCache();

        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },
            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                home.View.actions = null;
                home.Profile.requireSofime();
                //home.Profile.require("CT");

                var tpl = {
                    card: "sfExpatDocs"
                };

                var model = {
                    expatId: _.toInteger(path[1]),

                    get locked() {
                        return home.User.profile !== "SF";
                    },
                    expat: null,
                    rerouted: false
                };
                if (path.length > 1 && _.toInteger(path[1]) > 0 && path[1] === oldPath[1] && path[0] === oldPath[0]) return;

                console.log("path.length :" + path.length);
                if (path.length < 2 && path.length > 4
                    || !_.isSafeInteger(model.expatId)
                    || model.expatId <= 0) {
                    home.View.warn = true;
                    home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
                    return;
                }

                Promise.all([
                    jst.fetchTemplates(tpl),
                    Promise.all([
                        //RT.jQuery.get({
                        //	url: home.Route.masterData,
                        //	contentType: false,
                        //	dataType: "json"
                        //}).then(function (rs) {
                        //}),
                        RT.jQuery.get({
                            url: home.Route.sfExpat + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.expat = result.data.expat;
                            if (!_.isObject(model.expat) || !model.expat.id || !model.expat.cn) {
                                throw new Error("expat(" + model.expatId + "): unexpected response");
                            }
                        }),
                        RT.jQuery.get({
                            url: home.Route.expatsStaffDocuments + '0/' + model.expatId ,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.documents = result.data;
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
                        cachedMoment: cachedMoment,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    var $card = home.View.Pane.content.find('div.card').eq(0);

                    var documents = model.documents;

                    RT.Convert.toDate(documents.files, 'ctime');
                    RT.Convert.toDate(documents.files, 'mtime');
                   // documents.files = _.orderBy(documents.files, ['name']);

                    documents.files = documents.files.sort(function (a, b) {

                        var x = home.Locale.compare(a.type && a.type.name || "", b.type && b.type.name || "");
                        if (x === 0) x = home.Locale.compare(a.name || "", b.name || "");
                        return x === 0 ? a.id - b.id : x;
                    });


                    documents.document_type = _.orderBy(documents.document_type, ['default', 'name'], ['asc', 'asc']);

                    model.documents = documents;


                    var uploadedDocs = _.filter(model.documents.files, function (p) {
                        return p.has_file;
                    });

                    let immigrationActive = false;

                    _.each(model.expat.services, function(it){
                        if(it.isImmigration && it.isCreated)
                        {
                            immigrationActive = true;
                        }
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
                        documents: model.documents.files,
                        document_type: model.documents.document_type,
                        refExpat: model.expatId,
                        updateRoute: home.Route.expatsStaffDocuments,
                        requestRoute: home.Route.sfRequestDocuments,
                        immigrationActive : immigrationActive,
                        documentBlocks : [{
                            title: txt.rhViewExpatDocument,
                            viewType: 'upload',
                            enableFilter : false,
                            count : true,
                            canAdd: true,
                            canDelete: !model.locked,
                            canPrint: true,
                            canDownload: true,
                            canUpload: true,
                            canOpen: true,
                            emptyText : null,
                            showEmpty : true,
                            url :  home.Route.expatsStaffDocuments + '0/' + model.expatId + '/',
                            docs: _.filter(model.documents.files, function (p) {
                                return !p.has_file  && p.required;
                            })
                        },/* {
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
                        },*/ {
                            title: null,
                            viewType: 'browse',
                            count: true,
                            enableFilter: true,
                            canAdd: false,
                            canDelete: !model.locked,
                            canPrint: true,
                            canDownload: true,
                            canOpen: true,
                            canUpload: false,
                            showEmpty : false,
                            category: [
                                {id: "isAdmin", text: txt.expatDocumentAdmin, selected: true},
                                {id: "isMoving", text: txt.expatDocumentMoving, selected: false},
                                {id: "isImmigration", text: txt.expatDocumentImmigration, selected: false},
                                {id: "isHousing", text: txt.expatDocumentHousing, selected: false},
                                {id: "isHealth", text: txt.expatDocumentHealth, selected: false},
                                {id: "isInvoice", text: txt.expatDocumentInvoice, selected: false},
                                {id: "isPersonalDoc", text: txt.expatDocumentPersonalDoc, selected: false}
                            ],
                            emptyText: txt.incomingDocument,
                            url: home.Route.expatsStaffDocuments + '0/' + model.expatId + '/',
                            docs: _.filter(model.documents.files, function (p) {
                                var validCategory =  (p.type.isAdmin === true ||
                                    p.type.isMoving === true ||
                                    p.type.isImmigration === true ||
                                    p.type.isHousing === true ||
                                    p.type.isHealth === true ||
                                    p.type.isPersonalDoc === true ||
                                    p.type.isInvoice === true);

                                return p.has_file && validCategory ;
                            })
                        }]
                    }, ctx));



                }).catch(home.View.rejectHandler);
            }
        };
    }
);