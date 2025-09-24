define(
    ['app/home', 'app/RT', 'jquery', 'lodash'],
    function (home, RT, $, _) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        return function (context) {
            //home.View.title = txt.appName;
            ctx = context;
            jst = context.jst;
            home.View.actions = null;

            var tpl = {
                docs: null
            };
            var images = {
                circle: "ux-circle-down.svg",
                file: "ux-file.svg",
                add_file: "ux-square-add.svg",
                empty_file: "ux-file.svg",

                print: "ux-printer.svg",
                showInfo: "ux-zoom-in.svg",
                deleteFile: "ux-trash.svg",
                upload: "ux-upload.svg",
                download: "ux-download.svg",
                visibility : "ux-eye-off.svg"
            };

            var docs = [];
            _.each(ctx.documentBlocks, function(b) {
                docs = _.merge(docs, b.docs);
            });

            var model = {
                documents : docs,
                document_type : ctx.document_type,
                thumb: home.Image.Thumb.a4portrait,
                sortDone: ctx.sortDone,
                findDocumentTypeById : function (id) {
                    if (!id) return id;
                    return _.find(model.document_type, function (p) {
                        return p.id === id;
                    });
                },
                findDocumentById : function (id) {
                    if (!id) return id;

                    return _.find(model.documents, function (p) {
                        return p.id === id;
                    });
                }
            };

            Promise.all([
                Promise.all([
                    jst.template("documentsArray"),
                    home.Image.Vector.fetchSVG(images)
                ]).then(function (result) {
                    tpl.docs = result[0];

                })
            ]).then(function (/*result*/) {
                var $card = $(context.card);

                $card[0].innerHTML = tpl.docs(_.assign(model, {
                    menuUploadDocument: ctx.menuUploadDocument,
                    menuBrowseDocument: ctx.menuBrowseDocument,
                    uploadCount : ctx.uploadCount,
                    browseCount : ctx.browseCount,
                    documentBlocks: ctx.documentBlocks,
                    txt: txt,
                    fmt: fmt,
                    images: images,
                    route: home.Route
                }));

                var $thumbsPane = $card.find('.document-array-tools');
                var $thumbItems = $thumbsPane.find('.document-array-tool');

                function uploadFile(targetDocument, file, url) {
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
                                    label: txt.actionAccept
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

                                var dataSources = {
                                    documentType: model.documents.document_type
                                };

                                if (!editContext.replace) {
                                    $documentType = home.jQuery.createTypeAhead($documentType, {
                                        name: 'documentType',
                                        identityKey: 'id',
                                        displayKey: 'name',
                                        normalize: true,
                                        limit: 100,
                                        minLength: 0,
                                        source: _.constant(dataSources.documentType),
                                        onSelect: function (v) {
                                            editContext.refType = v.id;
                                            editContext.documentType = v;
                                            mediate();
                                        }
                                    });

                                    if (editContext.refType) {
                                        $documentType.value = model.findDocumentTypeById(editContext.refType);
                                    }
                                } else {
                                    $documentType.val(model.findDocumentTypeById(editContext.refType).name);
                                    $documentType.prop('disabled', true);
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

                                setTimeout(function () {
                                    $fileName.focus().select();
                                }, 50);
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

                                //_.assign(editContext, dataChoices);
                            }
                        });
                    }).then(function (result) {
                        if ("confirm" !== result) return result;

                        var targetId = editContext.replace ? editContext.replace.id : 0;
                        return RT.jQuery.put({
                            url: url + '0/0/' + targetId,
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
                    //if (home.Image.isImageType(extn) || extn === 'pdf') {
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
                            }
                            else {
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
                    }
                    catch (err) {
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
                    var targetDocument = model.findDocumentById($drop.data('id'));
                    var url = $drop.data('url');

                    var files = evt.dataTransfer.files;
                    if (files.length === 1) {
                        return uploadFile(targetDocument, files[0],url);
                    }
                    return false;
                };

                $thumbsPane.add($thumbItems).each(function () {
                    RT.Dnd.setupDnd($(this)[0], ondrop);
                });

                $thumbsPane.find('[data-action="upload"]').click(function (evt) {
                    evt.stopPropagation();

                    var trNode = $(this).closest('tr[data-id]');
                    var targetDocument = model.findDocumentById(trNode.data('id'));
                    var url = trNode.data('url');

                    var $uploadField = $(this).siblings('.upload-document-file');

                    var $pup = $uploadField.on('change', function (evt) {
                        var files = evt.originalEvent.target.files;
                        if (files.length === 1) {
                            uploadFile(targetDocument, files[0], url);
                        }
                    });
                    $uploadField.click();
                });

                $card.find('th.sortable[data-col]').on('click', function () {
                    var $th = $(this);
                    var att = $th.data("col");
                    var p = ctx.path.slice(0, 1);
                    p.push(model.sortDone.asc && model.sortDone.att === att ? "desc" : "asc");
                    p.push(att);
                    home.Router.go(p);
                });


                $thumbsPane.find('[data-action="download"]').click(function (evt) {
                    evt.stopPropagation();

                    var trNode = $(this).closest('tr[data-id]');
                    var targetDocument = model.findDocumentById(trNode.data('id'));
                    var url = trNode.data('url');

                    if (targetDocument) {
                        window.open(url + '0/0/' + targetDocument.id + "/original?mtime" + targetDocument.mtime.getTime(), "_self");
                    }
                });

                $thumbsPane.find('[data-action="open"]').click(function (evt) {
                    evt.stopPropagation();

                    var trNode = $(this).closest('tr[data-id]');
                    var targetDocument = model.findDocumentById(trNode.data('id'));
                    var url = trNode.data('url');

                    if (targetDocument) {
                        window.open(url + '0/0/'  + targetDocument.id + "/print?mtime" + targetDocument.mtime.getTime(), "_blank");
                    }
                });

                $thumbsPane.find('[data-action="print"]').click(function (evt) {
                    evt.stopPropagation();
                    var trNode = $(this).closest('tr[data-id]');
                    var targetDocument = model.findDocumentById(trNode.data('id'));
                    var url = trNode.data('url');

                    if (targetDocument) {

                        var type = targetDocument.thumb.type === 'application/pdf' ? 'pdf' : 'image';

                        printJS({
                            printable:url + '0/0/'  + targetDocument.id + '/print?mtime',
                            type: type,
                            showModal:true
                        });
                    }
                });

                $thumbsPane.find('[data-action="delete"]').click(function (evt) {
                    evt.stopPropagation();
                    var trNode = $(this).closest('tr[data-id]');
                    var targetDocument = model.findDocumentById(trNode.data('id'));
                    var url = trNode.data('url');

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
                                    //window.open(url + '0/0/' + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(), "_self");
                                    return RT.jQuery.delete({
                                        url: url + '0/0/'  + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(),
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

                $thumbsPane.find('[data-action="showinfo"]').click(function (evt) {
                    evt.stopPropagation();

                    var trNode = $(this).closest('tr[data-id]');
                    var targetDocument = model.findDocumentById(trNode.data('id'));
                    var url = trNode.data('url');

                    if (targetDocument) {
                        Promise.all([
                            jst.template('expatDocInfo')
                        ]).then(function (result) {
                            var expatDocInfo = result[0];
                            var dataChoices = {
                                dismiss: _.noop,
                                url : url
                            };

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

                                    var $fileName = $('#fileName');
                                    var $fileRemarks = $('#fileRemarks');
                                    var $documentType = $('#documentType');
                                    var $confirm = $pane.find('#confirm');

                                    var dataSources =  {
                                        documentType: model.documents.document_type
                                    };

                                    var readonly = true;
                                    if (!readonly) {
                                        $documentType = home.jQuery.createTypeAhead($documentType, {
                                            name: 'documentType',
                                            identityKey: 'id',
                                            displayKey: 'name',
                                            normalize: true,
                                            limit: 100,
                                            source: _.constant(dataSources.documentType),
                                            onSelect: function (v) {
                                                dataChoices.ref_type = v.id;
                                                dataChoices.documentType = v;
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
                                return RT.jQuery.post({
                                    url: url+ '0/0/'  + result.id,
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