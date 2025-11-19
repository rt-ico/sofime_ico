define(
    ['app/home', 'app/RT', 'jquery', 'lodash'],

    function (home, RT, $, _) {
        "use strict";

        var txt = RT.Text;
        var fmt = RT.Format;

        return function (context) {
            var ctx = context;
            var jst = context.jst;
            var home = context.home;
            var evt = context.evt;
            var place = context.place;
            var placeId = place.id;
            var $dialogCard = null;

            //home.View.title = txt.appName;
            home.View.actions = null;

            var tpl = {
                editPhoto: null
            };
            var model = {
                documents : [],
                thumb: home.Image.Thumb.a4landscape,

                findDocumentById : function (id) {
                    if (!id) return id;
                    return _.find(model.documents.files, function (p) {
                        return p.id === id;
                    });
                }
            };

            var l = place.location;

            var onDisplay = function ($card) {
                $dialogCard = $card;
                var $thumbsPane = $card.find('.photo-thumbs');
                var $thumbItems = $thumbsPane.find('.photo-thumb');

                function uploadFile(targetDocument, file) {
                    var editContext = {
                        dismiss: _.noop,
                        cancelUpload: _.noop,
                        thumbName: null,

                        fileName: targetDocument.name,
                        fileRemarks: targetDocument.remarks,
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
                            jst.template('visitDialogPhotoEdit')
                        ]);
                    }).then(function (result) {
                        // expect "template" function as first array result
                        if (!_.isArray(result) || !_.isFunction(result[0])) return;

                        // define upload "confirm" dialog
                        var dialogTpl = result[0];
                        var dataCache = {};

                        return RT.Dialog.create({
                            sheet: !window.matchMedia("(max-width: 800px)").matches,
                            overflow: true,
                            title: editContext.replace ? txt.dialogPhotoAddOrReplaceTitle : txt.dialogPhotoAddTitle,
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
                                return $(dialogTpl({
                                    fmt: fmt,
                                    txt: txt,
                                    editContext: editContext,
                                    thumb: home.Image.Thumb.a4landscape,
                                    route: home.Route
                                }));
                            },
                            onDisplay: function ($pane) {
                                var $fileName = $('#fileName');
                                var $fileRemarks = $('#fileRemarks');
                                var $confirm = $pane.find('#confirm');

                                var dataSources = {

                                };

                                //var readonly = true;
                                console.log('docTypes' + JSON.stringify(dataSources.documentType));

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

                                function mediate(){

                                    var b = (!$fileName.val()
                                        || ($fileName.val() === editContext.name
                                            && $fileRemarks.val() === editContext.originDocument.remarks));
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
                            url: home.Route.visitsDocuments + placeId + '/' + targetId,
                            data: JSON.stringify({
                                file_name: editContext.fileName,
                                remarks: editContext.fileRemarks,
                                cache_id: editContext.thumbName,
                                required: editContext.required
                            }),
                            contentType: "application/json",
                            dataType: false
                        });
                    }).then(function (result) {
                        if (_.isObject(result)) {
                            refresh($card);
                        }
                    })['catch'](home.View.rejectHandler);


                    var extn = home.File.toExtension(file.name);

                    var sendCount = 0;
                    //if (home.Image.isImageType(extn) || extn === 'pdf') {
                    editContext.isImage = home.Image.isImageType(extn) || extn === 'pdf';
                    editContext.originalName = file.name;

                    var data = new FormData();
                    data.append('a4landscape', file);
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

                    var targetDocument = model.findDocumentById($(this).closest('.photo[data-file]').data('file'));
                    var $uploadField = $(this).siblings('.upload-document-file');

                    var $pup = $uploadField.on('change', function (evt) {
                        var files = evt.originalEvent.target.files;
                        if (files.length === 1) {
                            uploadFile(targetDocument, files[0]);
                        }
                    });
                    $uploadField.click();
                });

                $thumbsPane.find('[data-action="download"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.photo[data-file]').data('file'));
                    if (targetDocument) {
                        window.open(home.Route.visitsDocuments + placeId + '/' + targetDocument.id + "/original?mtime" + targetDocument.mtime.getTime(), "_self");
                    }
                });

                $thumbsPane.find('[data-action="open"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.photo[data-file]').data('file'));
                    if (targetDocument) {
                        window.open(home.Route.visitsDocuments + placeId + '/' + targetDocument.id + "/print?mtime" + targetDocument.mtime.getTime(), "_blank");
                    }
                });

                $thumbsPane.find('[data-action="print"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.photo[data-file]').data('file'));
                    if (targetDocument) {

                        var type = targetDocument.thumb.type === 'application/pdf' ? 'pdf' : 'image';

                        printJS({
                            printable:home.Route.visitsDocuments + placeId + '/' + targetDocument.id + '/print?mtime',
                            type: type,
                            showModal:true
                        });

                    }
                });

                $thumbsPane.find('[data-action="delete"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.photo[data-file]').data('file'));

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
                                    //window.open(home.Route.visitsDocuments + placeId + '/ + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(), "_self");
                                    return RT.jQuery.delete({
                                        url: home.Route.visitsDocuments + placeId + '/' + targetDocument.id + "/delete?mtime" + targetDocument.mtime.getTime(),
                                        contentType: "application/json",
                                        dataType: false
                                    });
                                }
                            }
                        }).then(function (result) {
                            if (_.isObject(result)) {
                                refresh($card);
                            }
                        })['catch'](home.View.rejectHandler);
                        // });
                    }
                });

                $thumbsPane.find('[data-action="showinfo"]').click(function (evt) {
                    evt.stopPropagation();
                    var targetDocument = model.findDocumentById($(this).closest('.photo[data-file]').data('file'));
                    if (targetDocument) {
                        Promise.all([
                            jst.template('visitPhotoInfo')
                        ]).then(function (result) {
                            var infoTpl = result[0];
                            var dataChoices = {
                                dismiss: _.noop
                            };

                            _.assign(dataChoices, targetDocument);
                            dataChoices.originDocument = targetDocument;

                            return RT.Dialog.create({
                                sheet: !window.matchMedia("(max-width: 800px)").matches,
                                height: 540,
                                width: 800,
                                overflow: true,
                                title: txt.dialogPhotoInfoTitle,
                                dismiss: txt.actionCancel,
                                actions: [{
                                    id: 'confirm',
                                    label: txt.actionUpdate,
                                    disabled: true
                                }],
                                content: function () {
                                    return $(infoTpl({
                                        fmt: fmt,
                                        txt: txt,
                                        thumb: home.Image.Thumb.a4landscape,
                                        route: home.Route,
                                        dataChoices: dataChoices,
                                        place : place
                                    }));
                                },
                                onDisplay: function ($pane) {
                                    RT.jQuery.selectOnFocus($pane.find('input[type=text]'));

                                    var $fileName = $('#fileName');
                                    var $fileRemarks = $('#fileRemarks');
                                    var $confirm = $pane.find('#confirm');



                                    $fileName.val(dataChoices.name);
                                    $fileRemarks.val(dataChoices.remarks);

                                    function mediate(){
                                        $confirm.prop('disabled',
                                            (!$fileName.val() || ($fileName.val() === dataChoices.name
                                                && $fileRemarks.val() === dataChoices.originDocument.remarks)));
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
                                    url: home.Route.visitsDocuments + placeId + '/' + result.id,
                                    data: JSON.stringify({
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
                                refresh($card);
                            }
                        }).catch(home.View.rejectHandler);
                    }
                });

            };

            var refresh = function ($card) {

                Promise.all([
                    RT.jQuery.get({
                        url: home.Route.visitsDocuments + placeId + '/',
                        contentType: false,
                        dataType: "json"
                    })
                ]).then(function (result) {
                    var documents = result[0].data;

                    console.log('resfresh 02 : ' +  tpl.editPhoto(model));
                    RT.Convert.toDate(documents.files, 'ctime');
                    RT.Convert.toDate(documents.files, 'mtime');
                    documents.files = _.orderBy(documents.files, ['name']);

                    model.documents = documents;


                    //var $article = $card.find('article');
                    $dialogCard.find('article')[0].innerHTML = tpl.editPhoto(model);
                });
            };

            Promise.all([
                Promise.all([
                    jst.template("popupEditPhoto"),
                    RT.jQuery.get({
                        url: home.Route.visitsDocuments + placeId + '/',
                        contentType: false,
                        dataType: "json"
                    })
                ]).then(function (result) {
                    tpl.editPhoto = result[0];
                    var documents = result[1].data;

                    RT.Convert.toDate(documents.files, 'ctime');
                    RT.Convert.toDate(documents.files, 'mtime');
                    documents.files = _.orderBy(documents.files, ['name']);

                    model.documents = documents;
                })
            ]).then(function (/*result*/) {
                RT.Dialog.create({
                    title: txt.colPhotos + (l && l.address ? " - " + l.address : ""),
                    dismiss: txt.actionClose,
                    content: function () {
                        return tpl.editPhoto(_.assign(model, {
                            txt: txt,
                            fmt: fmt,
                            route: home.Route,
                            place: place
                        }))
                    },
                    onDisplay: function ($card) {
                        $dialogCard = $card;
                        onDisplay($dialogCard);
                    }
                }).catch(function (fault) {
                    home.View.warn = true;
                    console.error("dialog fault", fault);
                });
            }).catch(home.View.rejectHandler);
        }



    });