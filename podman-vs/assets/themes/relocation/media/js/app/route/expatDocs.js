define(
    ['app/home', 'app/RT', 'jquery', 'lodash'],
    function (home, RT, $, _) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        /*
            TODO: My Documents
                Liste des documents attribués expat (télécharger)
                Bouton ajouter un document (interface à préciser)
                Bouton demande de suppression des données RGPD
         */

        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },
            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                //home.View.title = txt.appName;
                if (sameRoute) return;
                home.View.actions = null;

                var tpl = {
                    docs: null
                };
                var images = {
                    circle: "ux-circle-down.svg",
                    update: "ux-update.svg",
                    file: "ux-file.svg",
                    add_file: "ux-square-add.svg",
                    empty_file: "ux-file.svg",

                    print: "ux-printer.svg",
                    showInfo: "ux-zoom-in.svg",
                    deleteFile: "ux-trash.svg",
                    upload: "ux-upload.svg",
                    download: "ux-download.svg",
                    visibility: "ux-eye-off.svg"
                };
                var model = {
                    documents: [],
                    family: [
                        {id: "isAdmin", text: txt.expatDocumentAdmin, selected: true},
                        {id: "isMoving", text: txt.expatDocumentMoving, selected: false},
                        {id: "isImmigration", text: txt.expatDocumentImmigration, selected: false},
                        {id: "isHousing", text: txt.expatDocumentHousing, selected: false},
                        {id: "isHealth", text: txt.expatDocumentHealth, selected: false}
                    ],
                    thumb: home.Image.Thumb.a4portrait,
                    findDocumentTypeById: function (id) {
                        if (!id) return id;
                        return _.find(model.documents.document_type, function (p) {
                            return p.id === id;
                        });
                    },
                    findDocumentById: function (id) {
                        if (!id) return id;
                        return _.find(model.fullDocs, function (p) {
                            return p.id === id;
                        });
                    }
                };

                Promise.all([
                    Promise.all([
                        jst.template("expatDocs"),
                        home.Image.Vector.fetchSVG(images),
                        RT.jQuery.get({
                            url: home.Route.expatsDocuments + '0/' + 'is_personal/',
                            contentType: false,
                            dataType: "json"
                        }),
                        RT.jQuery.get({
                            url: home.Route.expatsDocuments + '0/' + 'is_relo/',
                            contentType: false,
                            dataType: "json"
                        })
                    ]).then(function (result) {
                        tpl.docs = result[0];
                        var documents = {};
                        //from sfExpatDocs: var documents = model.documents;

                        RT.Convert.toDate(result[2].data.files, 'ctime');
                        RT.Convert.toDate(result[2].data.files, 'mtime');
                        RT.Convert.toDate(result[3].data.files, 'mtime');
                        RT.Convert.toDate(result[3].data.files, 'mtime');

                        //Sort documents by type instead of name.
                        documents.personalDocuments = _.orderBy(result[2].data.files, ['type.name']);
                        documents.reloDocuments = _.orderBy(result[3].data.files, ['type.name']);
                        documents.document_type = _.orderBy(result[2].data.document_type, ['default', 'name'], ['asc', 'asc']);
                        /*  From sfExpatDocs:
                            documents.files = documents.files.sort(function (a, b) {
                                var x = home.Locale.compare(a.type && a.type.name || "", b.type && b.type.name || "");
                                if (x === 0) x = home.Locale.compare(a.name || "", b.name || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                        */


                        var fullDocs = [];
                        _.each(documents.personalDocuments, function (doc) {
                            fullDocs.push(doc);
                        });
                        _.each(documents.reloDocuments, function (doc) {
                            fullDocs.push(doc);
                        });

                        model.fullDocs = fullDocs;
                        model.documents = documents;
                    })
                ]).then(function (/*result*/) {
                    if (fnHasPathChanged()) {
                        console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
                        return;
                    }
                    debugger;
                    var documentBlocks = [{
                        title: txt.requiredExpatDocument,
                        viewType: 'upload',
                        enableFilter: false,
                        count: true,
                        canAdd: true,
                        canDelete: true,
                        canPrint: true,
                        canDownload: true,
                        canUpload: true,
                        canOpen: true,
                        emptyText: null,
                        url: home.Route.expatsDocuments + '0/' + '/',
                        docs: _.filter(model.documents.personalDocuments, function (p) {
                            return !p.has_file && p.required;
                        })
                    }, {
                        title: txt.expatDocumentHistory,
                        viewType: 'upload',
                        enableFilter: false,
                        count: false,
                        canAdd: false,
                        canDelete: true,
                        canPrint: true,
                        canDownload: false,
                        canOpen: true,
                        canUpload: true,
                        emptyText: null,
                        url: home.Route.expatsDocuments + '0/' + '/',
                        docs: _.filter(model.documents.personalDocuments, function (p) {
                            return p.has_file;
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
                        emptyText: txt.incomingDocument,
                        url: home.Route.expatsDocuments + '0/' + '/',
                        docs: model.documents.reloDocuments
                    }];

                    home.View.Pane.content[0].innerHTML = tpl.docs(_.assign(model, {
                        documentBlocks: documentBlocks,
                        uploadCount: documentBlocks[0].docs.length,
                        showCount: _.filter(model.documents.reloDocuments, function (x) {
                            var inCategory = false;
                            _.each(model.family, function (f) {
                                inCategory = inCategory || (x.type && x.type[f.id]);
                            });
                            return x.has_file && inCategory;
                        }).length,
                        txt: txt,
                        fmt: fmt,
                        images: images,
                        route: home.Route
                    }));

                    var $card = $('#ExpatDocumentsCard');
                    var $thumbsPane = $card.find('.document-cards');
                    var $thumbItems = $thumbsPane.find('.document-card');


                    function uploadFile(targetDocument, file) {
                        var editContext = {
                            dismiss: _.noop,
                            cancelUpload: _.noop,
                            thumbName: null,

                            fileName: targetDocument.name,
                            fileRemarks: targetDocument.remarks,
                            refType: targetDocument.ref_type,
                            refExpat: targetDocument.ref_expat,
                            required: targetDocument.required,
                            replace: targetDocument
                        };

                        var setDropProgressText = function (text) {
                            if (editContext.dropProgress) {
                                editContext.dropProgress.text(text);
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
                                editContext.dropProgress = $('<div id="drop-progress"/>').text(' ');
                                return editContext.dropProgress;
                            },
                            onDisplay: function ($pane, fnDismissPane) {
                                editContext.dismiss = fnDismissPane;
                            }
                        }).then(function (result) {
                            // here: dialog dismissed (by user, or from XHR::onload)
                            if (!editContext.thumbName) {
                                editContext.cancelUpload();
                                console.warn("cancelUpload: %s", editContext.fileName);
                                return result;
                            }

                            return Promise.all([
                                jst.template('fileUploadConfirm')
                            ]);
                        }).then(function (result) {
                            // expect "template" function as first array result
                            if (!_.isArray(result) || !_.isFunction(result[0])) return;

                            // define upload "confirm" dialog
                            var fileUploadConfirm = result[0];
                            var dataCache = {};

                            return RT.Dialog.create({
                                sheet: !window.matchMedia("(max-width: 800px)").matches,
                                overflow: true,
                                title: editContext.replace ? txt.dialogFileAddOrReplaceTitle : txt.dialogFileAddTitle,
                                width: 800,
                                height: editContext.replace ? 560 : 500,
                                dismiss: txt.actionCancel,
                                actions: [
                                    {
                                        id: 'confirm',
                                        label: txt.actionAccept,
                                        click: function(evt, parent, defaultHandler, $pane, $header, $footer){
                                            let documentToReplace;
                                            if(!editContext.replace){
                                                let shouldConfirm = false;
                                                _.each(model.documents.personalDocuments, function (it) {
                                                    if ((it.type.name === editContext.documentType.name)&& it.has_file) {
                                                        documentToReplace = it;
                                                        shouldConfirm = true;
                                                    }
                                                });
                                                _.each(model.documents.reloDocuments, function (it) {
                                                    if ((it.type.name === editContext.documentType.name)&& it.has_file) {
                                                        documentToReplace = it;
                                                        shouldConfirm = true;
                                                    }
                                                });
                                                if(shouldConfirm === true ){
                                                    let smallScreen = window.matchMedia("(max-width: 420px)").matches;
                                                    console.log('small screen' + smallScreen);
                                                    new RT.Popup.create({
                                                        title: txt.dialogConfirmAddOrReplaceDocumentTitle,
                                                        subtitle: txt.dialogConfirmAddOrReplaceDocument,
                                                        top: smallScreen ? evt.clientY - 130 : evt.clientY - 8,
                                                        left: smallScreen ? 8 : evt.clientX - 8,
                                                        width: smallScreen ? 344 : 0,
                                                        height: 0,
                                                        sheet: smallScreen,
                                                        items: [{
                                                            id: "confirmAdd",
                                                            label: txt.dialogConfirmAddDocument
                                                        }, {
                                                            id: "confirmReplace",
                                                            label: txt.dialogConfirmReplaceDocument
                                                        }]
                                                    }).then(function(result){
                                                        if (_.isObject(result) && _.isString(result.id)) {
                                                            switch (result.id) {
                                                                case "confirmAdd":
                                                                    defaultHandler();
                                                                    break;
                                                                case "confirmReplace":
                                                                    editContext.replace = documentToReplace;
                                                                    editContext.refExpat = documentToReplace.ref_expat;

                                                                    defaultHandler();
                                                                    break
                                                            }
                                                        }
                                                    });
                                                }else{
                                                    defaultHandler();
                                                }
                                            }else{
                                                defaultHandler();
                                            }


                                        }
                                    }
                                ],
                                content: function () {
                                    return $(fileUploadConfirm({
                                        fmt: fmt,
                                        txt: txt,
                                        editContext: editContext,
                                        thumb: home.Image.Thumb.a4portrait,
                                        route: home.Route
                                    }));
                                },
                                onDisplay: function ($pane) {
                                    var $fileName = $('#fileName');
                                    var $fileRemarks = $('#fileRemarks');
                                    var $documentType = $('#documentType');
                                    var $confirm = $pane.find('#confirm');
                                    let dataSources = {
                                        documentType: [],
                                        findSourceById: function (id) {
                                            if (!id) return id;
                                            return _.find(dataSources.documentType, function (p) {
                                                return p.id === id;
                                            });
                                        }
                                    };

                                    _.each(model.documents.document_type, function(it){
                                        if(it.expatVisible){
                                            dataSources.documentType.push(it);
                                        }
                                    });

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
                                                editContext.refType = v.id;
                                                editContext.documentType = v;
                                            } else {
                                                editContext.refType = null;
                                                editContext.documentType = null;
                                            }
                                            $fileName.val(v.name);
                                            mediate();
                                        }
                                    });
                                    if (editContext.refType) {
                                        $documentType.value = model.findDocumentTypeById(editContext.refType);
                                    }

                                    if (editContext.replace) {
                                        $fileName.val(editContext.replace.name);
                                        $fileRemarks.val(editContext.replace.remarks);
                                        $pane.find('input[name="addOrReplace"][value="add"]').click(function () {
                                            if ($(this).is(':checked') && $fileName.val() === editContext.replace.name) {
                                                $fileName.val(editContext.fileName);
                                            }
                                        });
                                        $pane.find('input[name="addOrReplace"][value="replace"]').click(function () {
                                            if ($(this).is(':checked') && $fileName.val() === editContext.fileName) {
                                                $fileName.val(editContext.replace.name);
                                            }
                                        });
                                    }

                                    function mediate() {

                                        var b = (!$fileName.val()
                                            || !editContext.refType
                                            || ($fileName.val() === editContext.name
                                                && $fileRemarks.val() === editContext.originDocument.remarks)
                                            && editContext.originDocument.ref_type === editContext.refType);
                                        $confirm.prop('disabled', b);
                                    }

                                    mediate();
                                    $fileName.add($fileRemarks).on('keyup change', mediate);
                                    setTimeout("$('#documentType').focus();", 0)//To focus on the Type* field of the RT.dialog card created after uploading document
                                    /*setTimeout(function () {
                                        $('twitter-typeahead').focus();
                                    }, 50);*/
                                },
                                onResolve: function ($pane) {
                                    _.each(["fileName", "fileRemarks"], function (it) {
                                        var v = $.trim($('#' + it).val());
                                        if (!_.isEmpty(v)) {
                                            editContext[it] = v;
                                        }
                                    });

                                    if (editContext.replace && "add" === $pane.find('input[name="addOrReplace"]:checked').val()) {
                                        console.log("Add");
                                        delete editContext.replace;
                                    }


                                }
                            });


                        }).then(function (result) {

                            if ("confirm" !== result) return result;

                            var targetId = editContext.replace ? editContext.replace.id : 0;

                            return RT.jQuery.put({
                                url: home.Route.expatsDocuments + '0/' + targetId,
                                data: JSON.stringify({
                                    ref_expat: editContext.refExpat,
                                    ref_type: editContext.refType,
                                    file_name: editContext.fileName,
                                    remarks: editContext.fileRemarks,
                                    cache_id: editContext.thumbName,
                                    required: editContext.required
                                }),
                                contentType: "application/json",
                                dataType: false
                            });
                        }).then(function (result) {
                            home.View.inactive = false;
                            if (_.isObject(result)) {
                                home.Badge.invalidate();
                                home.Router.update();
                            }
                        })['catch'](home.View.rejectHandler);


                        var extn = home.File.toExtension(file.name);

                        var sendCount = 0;

                        editContext.isImage = home.Image.isImageType(extn) || extn === 'pdf';
                        editContext.originalName = file.name;

                        var data = new FormData();
                        data.append('a4portrait', file);
                        try {
                            var xhr = new XMLHttpRequest();
                            xhr.open('POST', home.Route.drop);
                            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); // enables server to decide to send 403, instead of redirect-to-login
                            xhr.onload = function () {
                                editContext.cancelUpload = _.noop;

                                if (xhr.status === 204) {
                                    var location = xhr.getResponseHeader("Location");
                                    var endOfPathAt = _.isString(location) ? location.lastIndexOf('/') : -1;
                                    if (endOfPathAt >= 0 && endOfPathAt < location.length - 1) {
                                        editContext.thumbName = location.substring(endOfPathAt + 1);
                                    }
                                    editContext.dismiss();
                                } else {
                                    home.View.warn = true;
                                    setDropProgressText(fmt.sprintf(txt.ajaxFileRejected, xhr.status));
                                }
                            };
                            xhr.upload.onprogress = function (evt) {
                                if (!evt.lengthComputable) return;
                                var complete = (evt.loaded / evt.total * 100 | 0);
                                setDropProgressText(fmt.sprintf(txt.dialogDropProgress, complete, file.name));
                            };

                            editContext.cancelUpload = function () {
                                xhr.abort();
                                editContext.dismiss();
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

                    var ondrop = function (evt) {
                        evt.stopPropagation();
                        evt.preventDefault();

                        var $drop = $(this).removeClass('dnd');
                        var targetDocument = model.findDocumentById($drop.data('file'));

                        var files = evt.dataTransfer.files;
                        if (files.length === 1) {
                            return uploadFile(targetDocument, files[0]);
                        }
                        return false;
                    };

                    $thumbsPane.add($thumbItems).each(function () {
                        RT.Dnd.setupDnd($(this)[0], ondrop);
                    });

                    $thumbsPane.find('[data-action="upload"]').click(function (evt) {
                        evt.stopPropagation();

                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        var $uploadField = $(this).siblings('.upload-document-file');

                        var $pup = $uploadField.on('change', function (evt) {
                            var files = evt.originalEvent.target.files;
                            if (files.length === 1) {
                                uploadFile(targetDocument, files[0]);
                            }
                        });
                        $uploadField.click();
                    });


                    $card.find('.help-icon').click(function (evt) {
                        evt.stopPropagation();

                        var $helpText = $('.document-help');
                        if ($helpText.hasClass('document-help-closed')) {
                            $helpText.removeClass('document-help-closed').addClass('document-help-open');
                        } else {
                            $helpText.removeClass('document-help-open').addClass('document-help-closed');
                        }
                    });

                    var selectedMenuId = null;
                    var selectedOngletId = null;
                    if (!_.isEmpty(path[1])) {
                        selectedMenuId = path[1];
                    } else {
                        selectedMenuId = $card.find('.doc-menu').first().data('id');
                    }
                    if (!_.isEmpty(path[2])) {
                        selectedOngletId = path[2];
                    } else {
                        selectedOngletId = $card.find('.doc-onglet').first().data('id');
                    }

                    var filterDocument = function (ongletId) {
                        var inactiveFilter = $card.find('.doc-onglets').hasClass('inactive');

                        $thumbsPane.find('.document-card').each(function (niop, node) {
                            var $node = $(node);
                            var value = $node.attr(ongletId);
                            var count = 0;

                            if ("true" === value || inactiveFilter) {
                                $node.show();
                                if ($node.hasClass('card-count')) {
                                    count++;
                                }
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
                        $thumbsPane.each(function (niop, node) {
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

                        _.each(model.family, function (f) {
                            var count = 0;
                            $thumbsPane.find('.document-card').each(function (niop, node) {
                                var $node = $(node);
                                if ($node.parent().is(':visible')) {
                                    var value = $node.attr(f.id);

                                    var hasFile = $node.data('has-file');
                                    if ("true" === value && $node.hasClass('card-count') && hasFile) {
                                        count++;
                                    }

                                }
                            });
                            $card.find('span.counter.' + f.id).text('(' + count + ')');
                            console.log('count' + count);
                            var $filterOption = $card.find('.doc-filters').find('.counter.' + f.id);
                            $filterOption.text($filterOption.text().replace(/[\d]+/g, count));
                            filterDocument(selectedOngletId);
                        })
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

                        home.Router.go([path[0], selectedMenuId, selectedOngletId]);

                        updateMenu();
                    });

                    if (!_.isEmpty(path[1])) {
                        $card.find('.doc-menu[data-id=' + path[1] + ']').first().click();
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

                            home.Router.go([path[0], selectedMenuId, selectedOngletId]);
                            filterDocument(selectedOngletId);
                            $card.find('.doc-filters').val(ongletId);
                        }
                    });
                    if (!_.isEmpty(path[2])) {
                        $card.find('.doc-onglet[data-id=' + path[2] + ']').first().click();
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

                    $thumbsPane.find('[data-action="download"]').click(function (evt) {
                        evt.stopPropagation();

                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        if (targetDocument) {
                            window.open(home.Route.expatsDocuments + '0/' + targetDocument.id + "/original?mtime" + targetDocument.mtime.getTime(), "_self");
                        }
                    });

                    $thumbsPane.find('[data-action="open"]').click(function (evt) {
                        evt.stopPropagation();

                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        if (targetDocument) {
                            window.open(home.Route.expatsDocuments + '0/' + targetDocument.id + "/print?mtime" + targetDocument.mtime.getTime(), "_blank");
                        }
                    });

                    $thumbsPane.find('[data-action="print"]').click(function (evt) {
                        evt.stopPropagation();
                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        if (targetDocument) {

                            var type = targetDocument.thumb.type === 'application/pdf' ? 'pdf' : 'image';

                            printJS({
                                printable: home.Route.expatsDocuments + '0/' + targetDocument.id + '/print?mtime',
                                type: type,
                                showModal: true
                            });
                        }
                    });

                    $thumbsPane.find('[data-action="delete"]').click(function (evt) {
                        evt.stopPropagation();
                        //var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        var $targetNode = $(this).closest('.document-card[data-file]');
                        var targetDocument = model.findDocumentById($targetNode.data('file'));

                        if (targetDocument) {
                            /*
                            Promise.all([
                                jst.template('expatDocInfo')
                            ]).then(function (result) {
                                var expatDocInfo = result[0];
            */
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
                                        //window.open(home.Route.expatsDocuments + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(), "_self");
                                        return RT.jQuery.delete({
                                            url: home.Route.expatsDocuments + '0/' + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(),
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

                    $thumbsPane.find('[data-action="showInfo"]').click(function (evt) {
                        evt.stopPropagation();

                        //var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        let $targetNode = $(this).closest('.document-card[data-file]');

                        let targetDocument = model.findDocumentById($targetNode.data('file'));

                        if (targetDocument) {
                            Promise.all([
                                jst.template('expatDocInfo')
                            ]).then(function (result) {
                                let expatDocInfo = result[0];
                                let dataChoices = {
                                    dismiss: _.noop,
                                    url: $targetNode.data('url'),
                                    images: images
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
                                        disabled: true,
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
                                        let $documentType = $('#documentType');
                                        let $fileRemarks = $('#fileRemarks');
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

                                        _.each(model.documents.document_type, function(it){
                                            if(it.expatVisible){
                                                dataSources.documentType.push(it);
                                            }
                                        });


                                        let readonly = false;

                                        if (!readonly) {
                                            $documentType = home.jQuery.createTypeAhead($documentType, {
                                                name: 'documentType',
                                                identityKey: 'id',
                                                displayKey: 'name',
                                                normalize: true,
                                                limit: 100,
                                                source: _.constant(dataSources.documentType),
                                                onSelect: function (v) {
                                                    if (_.isObject(v) && v.hasOwnProperty("id")) {
                                                        dataChoices.refType = v.id;
                                                        dataChoices.documentType = v;
                                                    } else {
                                                        dataChoices.refType = null;
                                                        dataChoices.documentType = null;
                                                    }
                                                    $fileName.val(v.name);
                                                    mediate();
                                                }

                                            });

                                            if (dataChoices.ref_type) {
                                                $documentType.value = dataSources.findSourceById(dataChoices.ref_type);
                                            }
                                        } else {
                                            $documentType.val(dataSources.findSourceById(dataChoices.ref_type).name);
                                            $documentType.prop('disabled', true);
                                        }

                                        $fileName.val(dataChoices.name);
                                        $fileRemarks.val(dataChoices.remarks);

                                        function mediate() {
                                            $confirm.prop('disabled',
                                                (!$fileName.val() || ($fileName.val() === dataChoices.name
                                                        && $fileRemarks.val() === dataChoices.originDocument.remarks)
                                                    && dataChoices.originDocument.ref_type === dataChoices.ref_type));
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
                                            _.each(["fileName", "fileRemarks"], function (it) {
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
                                            url: home.Route.expatsDocuments + '0/' + result.id,
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
                                            url: home.Route.expatsDocuments + '0/' + result.id,
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
            }
        };
    }
);