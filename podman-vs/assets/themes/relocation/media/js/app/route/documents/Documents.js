define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'app/route/documents/DocumentsUploadDialog'],
    function (home, RT, $, _, DocumentsUploadDialog) {
        "use strict";

        let ctx = null;
        let jst = null;
        let txt = RT.Text;
        let fmt = RT.Format;

        return function (context) {
            //home.View.title = txt.appName;
            ctx = context;
            jst = context.jst;
            home.View.actions = null;

            let tpl = {
                docs: null
            };

            let images = {
                circle: "ux-circle-down.svg",
                file: "ux-file.svg",
                add_file: "ux-square-add.svg",
                empty_file: "ux-file.svg",
                update: "ux-update.svg",
                print: "ux-printer.svg",
                showInfo: "ux-zoom-in.svg",
                deleteFile: "ux-trash.svg",
                upload: "ux-upload.svg",
                download: "ux-download.svg",
                visibility : "ux-eye-off.svg",
                requestDocument: "ux-input.svg",
                unRequestDocument: "ux-x.svg",
                chainUnrequestDocument: "ux-na.svg",
                reRequestDocument: "ux-photo.svg",
                toPanel: "ux-task-check.svg",
                add: "ux-add.svg",
                delete: "ux-trash.svg",
                multipleDelete: "multiple_delete.svg"
            };

            let model = {
                uploadCount : 0,
                browseCount : 0,
                documents : ctx.documents,
                document_type : ctx.document_type,
                thumb: home.Image.Thumb.a4portrait,
                filter: ctx.filter,
                isSfOrCt: (home.User.profile === ('SF') || home.User.profile === ('CT')),
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
                },
            };
            let fullDocs = [];
            _.each(ctx.documentBlocks, function(b) {
                _.each(b.docs, function(doc) {
                    fullDocs.push(doc);
                });
                if (b.viewType ===  'upload' && b.count) {
                    model.uploadCount += b.docs.length;
                }
                if (b.viewType ===  'browse' && b.count) {
                    model.browseCount += b.docs.length;
                }
            });
            model.fullDocs = fullDocs;
            model.immigrationActive = ctx.immigrationActive;

            Promise.all([
                Promise.all([
                    jst.template("documents"),
                    jst.template("documentsRequest"),
                    jst.template("documentsRequestItemList"),
                    jst.template("documentsUnRequest"),
                    home.Image.Vector.fetchSVG(images)
                ]).then(function (result) {
                    tpl.docs = result[0];
                    tpl.documentsRequest = result[1];
                    tpl.documentsRequestItemList = result[2];
                    tpl.documentsUnRequest = result[3];

                })
            ]).then(function (/*result*/) {
                let $card = $(context.card);

                $card[0].innerHTML = tpl.docs(_.assign(model, {
                    menuUploadDocument: ctx.menuUploadDocument,
                    menuBrowseDocument: ctx.menuBrowseDocument,
                    documentBlocks: ctx.documentBlocks,
                    txt: txt,
                    fmt: fmt,
                    images: images,
                    route: home.Route
                }));

                let controls = {
                    restyled: RT.jQuery.restyleInputs($card),
                    documentPicker: []
                };

                let $cardPane = $card.find('.document-cards');
                let $thumbItems = $cardPane.find('.document-card');
                let getListForTypeAhead = function (items){
                    let dataset = _.values(items).sort(function (a, b) {
                        let x = home.Locale.compare(a.name, b.name);
                        return x === 0 ? a.id - b.id : x;
                    });
                    dataset.unshift({
                        id: 0,
                        name: txt.selectDocumentType
                    });
                    return dataset;
                };

                let ondrop = function (evt) {
                    evt.stopPropagation();
                    evt.preventDefault();

                    let $drop = $(this).removeClass('dnd');
                    let targetDocument = model.findDocumentById($drop.data('file'));

                    let files = evt.dataTransfer.files;
                    if (files.length === 1) {
                        return new DocumentsUploadDialog({
                            targetDocument : targetDocument,
                            refExpat : ctx.refExpat,
                            model : model,
                            jst : context.jst,
                            files : files,
                            refresh : true
                        });
                    }
                    return false;
                };

                $cardPane.add($thumbItems).each(function () {
                    RT.Dnd.setupDnd($(this)[0], ondrop);
                });

                let $requestDocument = $cardPane.find('[data-action="requestDocument"]');

                $requestDocument.click(function (evt) {
                    evt.stopPropagation();
                    let newDocumentTypeJSId = 1;
                    let documentTypeList = {
                        [newDocumentTypeJSId]:{
                            id: newDocumentTypeJSId,
                            added:false
                        }
                    };
                    let numberOfListedDocumentType = 1;
                    let numberOfListedDocumentUpperLimit = 7;

                    RT.Dialog.create({
                        sheet: !window.matchMedia("(max-width: 800px)").matches,
                        height: 540,
                        width: 800,
                        overflow: true,
                        title: txt.dialogRequestDocument,
                        dismiss: txt.actionCancel,
                        actions: [{
                            id: 'confirm',
                            label: txt.actionUpdate,
                            disabled: true,
                        }],

                        content: function () {
                            return $(tpl.documentsRequest({
                                fmt: fmt,
                                txt: txt,
                                thumb: home.Image.Thumb.a4portrait,
                                route: home.Route,
                                images: images
                            }));
                        },
                        onDisplay: function ($pane) {
                            //RT.jQuery.selectOnFocus($pane.find('input[type=text]'));
                            let $confirm = $pane.find('#confirm');
                            let selectedDocumentType = false;
                            let $documentType = {
                                [1]:$('#documentType')
                            };
                            //documentTypeList[newDocumentTypeJSId].id = newDocumentTypeJSId;
                            controls.documentPicker[1] = home.jQuery.createTypeAhead($documentType[1], {
                                name: 'documentType',
                                identityKey: 'id',
                                displayKey: 'name',
                                normalize: true,
                                limit: 100,
                                minLength: 0,
                                source: _.constant(getListForTypeAhead(model.document_type)),
                                onSelect: function (v) {
                                    if (_.isObject(v) && v.hasOwnProperty("id")) {
                                        selectedDocumentType = true;
                                        documentTypeList[1].refType = v.id !== 0 ? v.id : null;
                                        documentTypeList[1].documentType = v;
                                        documentTypeList[1].added = true;
                                    } else {
                                        //documentTypeList[1].refType = null;
                                        //documentTypeList[1].documentType = null;
                                        documentTypeList[1].added = false;
                                    }
                                    mediate();
                                }
                            });

                            if (documentTypeList[1].refType) {
                                $documentType.value = model.findDocumentTypeById(documentTypeList[1].refType);

                            }else{
                                $documentType.value = model.findDocumentTypeById();
                            }
                            function mediate() {
                                $confirm.prop('disabled', !selectedDocumentType);
                            }


                            let $itemList = $pane.find('.itemList');


                            let $addNewDocumentTypeRequest = $pane.find('.addNewDocumentTypeRequest');
                            $addNewDocumentTypeRequest.on('click', function(){
                                if(!$addNewDocumentTypeRequest.hasClass("disabled")){
                                    newDocumentTypeJSId++;
                                    RT.jQuery.withClassIf($addNewDocumentTypeRequest, "disabled", ++numberOfListedDocumentType >= numberOfListedDocumentUpperLimit );
                                    documentTypeList[newDocumentTypeJSId] = {};
                                    documentTypeList[newDocumentTypeJSId].refType = null;
                                    documentTypeList[newDocumentTypeJSId].documentType = null;
                                    documentTypeList[newDocumentTypeJSId].added = false;
                                    $itemList.append(tpl.documentsRequestItemList (_.assign({
                                        route: home.Route,
                                        images: images,
                                        txt: txt,
                                        fmt: fmt,
                                        id: newDocumentTypeJSId
                                    }, model)));
                                    $documentType[newDocumentTypeJSId] = $pane.find('input[name="documentType'+newDocumentTypeJSId+'"]');
                                    controls.documentPicker[newDocumentTypeJSId] = home.jQuery.createTypeAhead($documentType[newDocumentTypeJSId], {
                                        name: 'documentType',
                                        identityKey: 'id',
                                        displayKey: 'name',
                                        normalize: true,
                                        limit: 100,
                                        minLength: 0,
                                        source: _.constant(getListForTypeAhead(model.document_type)),
                                        onSelect: function (v) {
                                            if (_.isObject(v) && v.hasOwnProperty("id")) {
                                                selectedDocumentType = true;
                                                documentTypeList[newDocumentTypeJSId].refType = v.id !== 0 ? v.id : null;
                                                documentTypeList[newDocumentTypeJSId].documentType = v;
                                                documentTypeList[newDocumentTypeJSId].added =  v.id !== 0;
                                            } else {
                                                //documentTypeList[newDocumentTypeJSId].refType = null;
                                                //documentTypeList[newDocumentTypeJSId].documentType = null;
                                                documentTypeList[newDocumentTypeJSId].added = false;
                                            }
                                            mediate();
                                        }
                                    });
                                    $pane.find('[data-action=remove'+newDocumentTypeJSId+']').on('click', function(evt){
                                        evt.stopPropagation();
                                        let id = $(this).closest('div.documentTypeItem').data("id");
                                        documentTypeList[id].added = false;
                                        $(this).closest('div.documentTypeItem').remove();
                                        RT.jQuery.withClassIf($addNewDocumentTypeRequest, "disabled", --numberOfListedDocumentType >= numberOfListedDocumentUpperLimit );
                                    });



                                }
                            });

                            mediate();
                            //setTimeout("$pane.find('input[name=\"documentType'+newDocumentTypeJSId+'\"]').focus();", 10);


                        },
                        onResolve: function ($pane, id) {
                            if (id === 'confirm') {
                                let documentToSendList = [];
                                _.each(documentTypeList, function(it){
                                    if(it.added === true && it.refType != null){
                                        debugger;
                                        documentToSendList.push(it);
                                    }
                                })
                                return RT.jQuery.put({
                                    url: ctx.requestRoute,
                                    data: JSON.stringify({
                                        refExpat: ctx.refExpat,
                                        documentTypeList:documentToSendList,
                                    }),
                                    contentType: "application/json",
                                    dataType: false
                                });
                            }
                        }
                    }).then(function (result) {
                        if(result.statusCode === 200 ){
                            home.Router.update();
                        }
                        return;
                    })['catch'](home.View.rejectHandler);
                })
                $cardPane.find('[data-action="removeRequiredDocument"]').click(function (evt){
                    evt.stopPropagation();
                    let targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));

                    let newDocumentTypeJSId = 1;
                    let documentTypeList = {
                        [newDocumentTypeJSId]:{
                            refType: targetDocument.id,
                            name: targetDocument.type.name,
                            added:true
                        }
                    };
                    let numberOfListedDocumentType = 1;
                    let numberOfListedDocumentUpperLimit = 7;
                    let currentDocumentsList = [];
                    let size = 0;
                    _.each(model.documentBlocks[0].docs, function(it){
                        size++;
                        let item = {
                            id: 0,
                            name: ""
                        }
                        item.id = it.id;
                        item.checked = it.id === targetDocument.id;
                        item.name = it.type.name;
                        currentDocumentsList.push(item);
                    });
                    debugger;
                    //let size = 180 + currentDocumentsList.length()*40;

                    RT.Dialog.create({
                        sheet: !window.matchMedia("(max-width: 800px)").matches,
                        height: Math.max(Math.min(150+size*44,820),540),
                        width: 800,
                        overflow: true,
                        title: txt.dialogUnRequestDocument,
                        dismiss: txt.actionCancel,
                        actions: [{
                            id: 'confirm',
                            label: txt.delete,
                            disabled: true,
                        }],

                        content: function () {
                            return $(tpl.documentsUnRequest({
                                fmt: fmt,
                                txt: txt,
                                thumb: home.Image.Thumb.a4portrait,
                                route: home.Route,
                                images: images,
                                currentDocumentsList:currentDocumentsList,
                                selectedDocument: documentTypeList[1]
                            }));
                        },
                        onDisplay: function ($pane) {
                            let $documentType = {
                                [1]:$('#documentType')
                            };
                            let $confirm = $pane.find('#confirm');
                            let selectedDocumentType = true;


                            controls.restyled = RT.jQuery.restyleInputs($pane);
                            controls.documentToRemove = currentDocumentsList;
                            _.each(controls.documentToRemove, function(it){
                                it.remove = $pane.find('input[name="remove'+it.id+'"]');
                            });

                            function mediate() {
                                $confirm.prop('disabled', !selectedDocumentType);
                            }



                            mediate();

                            //setTimeout("$documentType[newDocumentTypeJSId].focus();", 0);
                        },
                        onResolve: function ($pane, id) {
                            if (id === 'confirm') {
                                let documentToSendList = [];
                                debugger;
                                _.each(controls.documentToRemove, function(it){
                                    if(it.remove[0].checked){
                                        documentToSendList.push(it);
                                    }
                                })
                                return RT.jQuery.delete({
                                    url: ctx.requestRoute,
                                    data: JSON.stringify({
                                        refExpat: ctx.refExpat,
                                        documentTypeList:documentToSendList,
                                    }),
                                    contentType: "application/json",
                                    dataType: false
                                });
                            }
                        }
                    }).then(function (result) {
                        if(result.statusCode === 200 ){
                            home.Router.update();
                        }
                        return;
                    })['catch'](home.View.rejectHandler);

                })

                /*$cardPane.find('[data-action="unRequestDocument"]').click(function (evt){
                    evt.stopPropagation();
                    let targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                    let documentId = targetDocument.id;

                    return RT.jQuery.delete({
                        url: ctx.requestRoute+'/'+home.User.id+'/'+ctx.refExpat+'/'+documentId,
                    }).then(function(){
                        home.Router.update();
                    })
                })*/


                $cardPane.find('[data-action="upload"]').click(function (evt) {
                    evt.stopPropagation();

                    let targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                    let $uploadField = $cardPane.find('.dataActionUpload');

                    let $pup = $uploadField.on('change', function (evt) {
                        let files = evt.originalEvent.target.files;
                        if (files.length === 1) {
                            debugger;
                            new DocumentsUploadDialog({
                                targetDocument : targetDocument,
                                refExpat : ctx.refExpat,
                                model : model,
                                jst : context.jst,
                                files : files,
                                refresh : true
                            });
                        }
                    });
                    $uploadField.click();
                });


                let selectedMenuId = null;
                let selectedOngletId = null;
                if (!_.isEmpty(context.menu)) {
                    selectedMenuId = context.menu;
                } else {
                    selectedMenuId = $card.find('.doc-menu').first().data('id');
                }
                if (!_.isEmpty(context.filter)) {
                    selectedOngletId = context.filter;
                } else {
                    selectedOngletId = $card.find('.doc-onglet').first().data('id');
                }

                let filterDocument = function (ongletId) {
                    let inactiveFilter = $card.find('.doc-onglets').hasClass('inactive');

                    $card.find('.document-card').each(function (niop, node) {
                        let $node = $(node);
                        let value = $node.attr(ongletId);
                        let activeFilter = $node.data('enable-filter');
                        let count = 0;

                        if ("true" === value || !activeFilter) {
                            $node.show();
                            if ($node.hasClass('card-count')) { count++; }
                        } else {
                            $node.hide();
                        }
                        if (count === 0) {
                            // $node.parent().hide();
                        } else {
                            //$node.parent().show();
                        }
                    });
                };

                var updateMenu = function () {
                    var displayFilter = false;
                    $cardPane.each(function (niop, node) {
                        var $node = $(node);

                        if ($node.hasClass(selectedMenuId)) {
                            $node.show();
                            if ($node.data('enable-filter') === true) {
                                displayFilter = true;
                            }
                        } else {
                            $node.hide();
                        }
                    });

                    if (selectedMenuId === "browse") {
                        $card.find('.document-category-label').show();
                    } else {
                        $card.find('.document-category-label').hide();
                    }

                    if (displayFilter === true) {
                        $card.find('.doc-onglets').removeClass('inactive');
                        $card.find('.doc-filters').removeClass('inactive');
                    } else {
                        $card.find('.doc-onglets').addClass('inactive');
                        $card.find('.doc-filters').addClass('inactive');
                    }

                    filterDocument(selectedOngletId);

                    _.each(model.documentBlocks, function (b) {
                        _.each(b.category, function (f) {
                            var count = 0;
                            $cardPane.find('.document-card').each(function (niop, node) {
                                var $node = $(node);
                                if ($node.parent().is(':visible')) {
                                    var value = $node.attr(f.id);

                                    if ("true" === value && $node.hasClass('card-count')) {
                                        count++;
                                    }

                                }
                            });
                            $card.find('span.counter.' + f.id).text('(' + count + ')');

                            var $filterOption = $card.find('.doc-filters').find('.counter.' + f.id);
                            $filterOption.text($filterOption.text().replace(/[\d]+/g, count));
                        });
                    });

                };
                updateMenu();

                $card.find('.doc-menu').click(function (evt) {
                    evt.stopPropagation();

                    var $this = $(this);
                    var targetDocument = $this.data('id');
                    $this.parents().children().removeClass('nav-selected');
                    $this.addClass('nav-selected');

                    var menuId = $this.data('id');
                    if (menuId === selectedMenuId) return;
                    selectedMenuId = menuId;

                    home.Router.go([ctx.path, selectedMenuId, selectedOngletId]);

                    updateMenu();
                });

                if (!_.isEmpty(ctx.menu)) {
                    $card.find('.doc-menu[data-id=' + ctx.menu + ']').first().click();
                } else {
                    $card.find('.doc-menu').first().click();
                }

                $card.find('.doc-onglet').click(function (evt) {
                    evt.stopPropagation();

                    var $this = $(this);
                    var ongletId = $this.data('id');

                    $this.parents().children().removeClass('nav-selected');
                    $this.addClass('nav-selected');

                    if (selectedOngletId !== ongletId) {
                        selectedOngletId = ongletId;

                        home.Router.go([ctx.path, selectedMenuId, selectedOngletId]);
                        filterDocument(selectedOngletId);
                        $card.find('.doc-filters').val(ongletId);
                    }
                });
                if (!_.isEmpty(ctx.filter)) {
                    $card.find('.doc-onglet[data-id=' + ctx.filter + ']').first().click();
                } else {
                    $card.find('.doc-onglet').first().click();
                }

                $card.find('.doc-filters').on('change', function (evt) {
                    evt.stopPropagation();

                    var $option = $(this).find("option:selected");
                    var ongletId = $option.data('id');
                    if (selectedOngletId !== ongletId) {
                        $card.find('.doc-onglet[data-id=' + ongletId + ']').click();
                    }
                });

                $cardPane.find('[data-action="toImmigration"]').click(function (evt) {
                    evt.stopPropagation();
                    home.Router.go(["sfExpatImmigration/" + context.refExpat +"/"]);
                });
                $cardPane.find('[data-action="download"]').click(function (evt) {
                    evt.stopPropagation();

                    var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                    if (targetDocument) {
                        window.open(home.Route.expatsStaffDocuments + '0/0/' + targetDocument.id + "/original?mtime" + targetDocument.mtime.getTime(), "_self");
                    }
                });

                $cardPane.find('[data-action="open"]').click(function (evt) {
                    evt.stopPropagation();


                    var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                    console.log('open : ' + targetDocument);
                    if (targetDocument) {
                        window.open(home.Route.expatsStaffDocuments + '0/0/'  + targetDocument.id + "/print?mtime" + targetDocument.mtime.getTime(), "_blank");
                    }
                });

                $cardPane.find('[data-action="print"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                    if (targetDocument) {

                        var type = targetDocument.thumb.type === 'application/pdf' ? 'pdf' : 'image';

                        printJS({
                            printable:home.Route.expatsStaffDocuments + '0/0/'  + targetDocument.id + '/print?mtime',
                            type: type,
                            showModal:true
                        });
                    }
                });

                $cardPane.find('[data-action="delete"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));

                    if (targetDocument) {
                        return RT.Dialog.create({
                            sheet: true,
                            overflow: true,
                            title: txt.actionDelete,
                            width: 400,
                            height: 280,
                            dismiss: txt.actionCancel,
                            actions: [{
                                id: 'confirm',
                                label: txt.actionDelete
                            }],
                            content: function () {
                                return '<p>' + txt.dialogDeleteConfirm + '</p>';

                            },
                            onDisplay: function ($pane) {


                            },
                            onResolve: function ($pane, id) {
                                if (id === 'confirm') {
                                    //window.open(home.Route.expatsStaffDocuments + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(), "_self");
                                    return RT.jQuery.delete({
                                        url: home.Route.expatsStaffDocuments + '0/0/'  + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(),
                                        contentType: "application/json",
                                        dataType: false
                                    });
                                }
                            }
                        }).then(function (result) {
                            if (_.isObject(result)) {
                                home.Badge.invalidate();
                                home.Router.update();
                            }
                        })['catch'](home.View.rejectHandler);
                        // });
                    }
                });

                $cardPane.find('[data-action="showInfo"]').click(function (evt) {
                    evt.stopPropagation();

                    let $targetNode = $(this).closest('.document-card[data-file]');
                    let targetDocument = model.findDocumentById($targetNode.data('file'));

                    //var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                    if (targetDocument) {
                        Promise.all([
                            jst.template('expatDocInfo')
                        ]).then(function (result) {
                            let expatDocInfo = result[0];
                            let dataChoices = {
                                dismiss: _.noop,
                                url : $targetNode.data('url'),
                                images : images
                            };
                            function editFile(targetDocument, file) {
                                let newFile = {
                                    dismiss: _.noop,
                                    cancelUpload: _.noop,
                                    thumbName: null,

                                    replace: targetDocument
                                };

                                let setDropProgressText = function (text) {
                                    if (newFile.dropProgress) {
                                        newFile.dropProgress.text(text);
                                    }
                                };

                                home.View.inactive = true;

                                // upload "progress" dialog
                                RT.Dialog.create({
                                    sheet: true,
                                    title: txt.dialogDropTitle,
                                    width: 400,
                                    height: 200,
                                    dismiss: txt.actionCancel,
                                    content: function () {
                                        newFile.dropProgress = $('<div id="drop-progress"/>').text(' ');
                                        return newFile.dropProgress;
                                    },
                                    onDisplay: function ($pane, fnDismissPane) {
                                        newFile.dismiss = fnDismissPane;
                                    }


                                }).then(function (result) {
                                    if (!newFile.thumbName) {
                                        newFile.cancelUpload();
                                        console.warn("cancelUpload: %s", newFile.fileName);
                                        return result;
                                    }

                                    return Promise.all([
                                        jst.template('fileUploadConfirm')
                                    ]);
                                }).then(function (result) {
                                    if (!_.isArray(result) || !_.isFunction(result[0])) return;

                                    // define upload "confirm" dialog
                                    let fileUploadConfirm = result[0];
                                    let dataCache = {};
                                    return result;

                                }).then(function (result) {
                                    home.View.inactive = false;
                                    if (_.isObject(result)) {
                                        home.Badge.invalidate();
                                        home.Router.update();
                                    }
                                })['catch'](home.View.rejectHandler);


                                let extn = home.File.toExtension(file.name);

                                let sendCount = 0;

                                newFile.isImage = home.Image.isImageType(extn) || extn === 'pdf';
                                newFile.originalName = file.name;

                                let data = new FormData();
                                data.append('a4portrait', file);
                                try {
                                    let xhr = new XMLHttpRequest();
                                    xhr.open('POST', home.Route.drop);
                                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); // enables server to decide to send 403, instead of redirect-to-login
                                    xhr.onload = function () {
                                        newFile.cancelUpload = _.noop;

                                        if (xhr.status === 204) {
                                            let location = xhr.getResponseHeader("Location");
                                            let endOfPathAt = _.isString(location) ? location.lastIndexOf('/') : -1;
                                            if (endOfPathAt >= 0 && endOfPathAt < location.length - 1) {
                                                dataChoices.thumbName = location.substring(endOfPathAt + 1);
                                                $('.img-edit')[0].src = home.Route.drop + dataChoices.thumbName;
                                            }
                                            newFile.dismiss();
                                        } else {
                                            home.View.warn = true;
                                            setDropProgressText(fmt.sprintf(txt.ajaxFileRejected, xhr.status));
                                        }
                                    };
                                    xhr.upload.onprogress = function (evt) {
                                        if (!evt.lengthComputable) return;
                                        let complete = (evt.loaded / evt.total * 100 | 0);
                                        setDropProgressText(fmt.sprintf(txt.dialogDropProgress, complete, file.name));
                                    };

                                    newFile.cancelUpload = function () {
                                        xhr.abort();
                                        newFile.dismiss();
                                    };

                                    xhr.send(data);
                                    sendCount = 1;
                                } catch (err) {
                                    home.View.warn = true;
                                    setDropProgressText(txt.ajaxNetworkError);
                                }
                                // }


                                if (sendCount < 1) {
                                    home.View.warn = true;
                                    setDropProgressText(dropCount > 1 ? txt.ajaxFileSingleItemOnly : txt.ajaxFileUnsupported);
                                    setTimeout(function () {
                                        home.View.warn = false;
                                    }, 1000);
                                }

                                return false;
                            }
                            _.assign(dataChoices, targetDocument);
                            dataChoices.originDocument = targetDocument;

                            return RT.Dialog.create({
                                sheet: !window.matchMedia("(max-width: 800px)").matches,
                                height: 540,
                                width: 800,
                                overflow: true,
                                title: txt.dialogExpatInfoTitle,
                                dismiss: txt.actionCancel,
                                actions: [{
                                    id: 'confirm',
                                    label: txt.actionUpdate,
                                    disabled: true
                                }],
                                content: function () {
                                    return $(expatDocInfo({
                                        fmt: fmt,
                                        txt: txt,
                                        thumb: home.Image.Thumb.a4portrait,
                                        route: home.Route,
                                        dataChoices: dataChoices
                                    }));
                                },
                                onDisplay: function ($pane) {
                                    RT.jQuery.selectOnFocus($pane.find('input[type=text]'));

                                    let $fileName = $('#fileName');
                                    let $fileRemarks = $('#fileRemarks');
                                    let $documentType = $('#documentType');
                                    let $confirm = $pane.find('#confirm');

                                    let dataSources = {
                                        documentType: [],
                                        findSourceById: function (id) {
                                            if (!id) return id;
                                            return _.find(dataSources.documentType, function (p) {
                                                return p.id === id;
                                            });
                                        }
                                    };
                                    if(home.User.profile ==='HR'){
                                        _.each(model.document_type, function(it){
                                            if(it.hrVisible){
                                                dataSources.documentType.push(it);
                                            }
                                        });
                                    }else{
                                        dataSources =  {
                                            documentType: model.document_type
                                        };
                                    }

                                    let readonly = false;
                                    if (!readonly) {
                                        $documentType = home.jQuery.createTypeAhead($documentType, {
                                            name: 'documentType',
                                            identityKey: 'id',
                                            displayKey: 'name',
                                            normalize: true,
                                            limit: 100,
                                            minLength: 0,
                                            source: _.constant(dataSources.documentType),
                                            onSelect: function (v) {
                                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                                    dataChoices.ref_type = v.id;
                                                    dataChoices.documentType = v;
                                                } else {
                                                    dataChoices.ref_type = null;
                                                    dataChoices.documentType = null;
                                                }
                                                $fileName.val(v.name);
                                                mediate();
                                            }
                                        });

                                        if (dataChoices.ref_type) {
                                            $documentType.value = model.findDocumentTypeById(dataChoices.ref_type);
                                        }
                                    } else {
                                        $documentType.val(model.findDocumentTypeById(dataChoices.ref_type).name);
                                        $documentType.prop('disabled', true);
                                    }

                                    $fileName.val(dataChoices.name);
                                    $fileRemarks.val(dataChoices.remarks);

                                    function mediate(){
                                        $confirm.prop('disabled',
                                            (!$fileName.val() || ($fileName.val() === dataChoices.name
                                                && $fileRemarks.val() === dataChoices.originDocument.remarks)
                                                && dataChoices.originDocument.ref_type === dataChoices.ref_type ));
                                    }

                                    $fileName.add($fileRemarks).on('keyup change', mediate);
                                    $pane.find('[data-action="fileUpload"]').click(function (evt) {
                                        evt.stopPropagation();

                                        let $uploadField = $(this).siblings('.upload-document-file');

                                        let $pup = $uploadField.on('change', function (evt) {

                                            let files = evt.originalEvent.target.files;

                                            if (files.length === 1) {
                                                editFile(targetDocument, files[0]);

                                                mediate();
                                            }
                                        });
                                        $uploadField.click();
                                    });
                                    setTimeout("$('#documentType').focus();", 0)
                                },
                                onResolve: function ($pane, id) {
                                    if (id === 'confirm') {
                                        _.each(["fileName", "fileRemarks" ], function (it) {
                                            var v = $.trim($('#' + it).val());
                                            if (!_.isEmpty(v)) {
                                                dataChoices[it] = v;
                                            }
                                        });
                                        return dataChoices;
                                    }
                                }
                            });
                        }).then(function (result) {
                            if (_.isObject(result) && result.name) {
                                if(result.thumbName){
                                    return RT.jQuery.put({
                                        url: ctx.updateRoute + '0/' + ctx.refExpat + '/'  + result.id,
                                        data: JSON.stringify({
                                            ref_expat: result.ref_expat,
                                            ref_type: result.ref_type,
                                            file_name: result.fileName,
                                            remarks: result.fileRemarks,
                                            cache_id: result.thumbName,
                                            required: result.required
                                        }),
                                        contentType: "application/json",
                                        dataType: false
                                    });
                                }else{
                                    return RT.jQuery.post({
                                        url: ctx.updateRoute + '0/'+ ctx.refExpat + '/'  + result.id,
                                        data: JSON.stringify({
                                            ref_expat: result.ref_expat,
                                            ref_type: result.ref_type,
                                            file_name: result.fileName,
                                            remarks: result.fileRemarks,
                                            required: result.required
                                        }),
                                        contentType: "application/json",
                                        dataType: false
                                    });
                                }
                            }
                        }).then(function (result) {
                            if (_.isObject(result)) {
                                home.Router.update();
                            }
                        }).catch(home.View.rejectHandler);
                    }
                });


            }).catch(home.View.rejectHandler);
        };
    }
);