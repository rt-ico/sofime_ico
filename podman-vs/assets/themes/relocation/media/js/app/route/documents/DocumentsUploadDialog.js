define(
    ['app/home', 'app/RT', 'jquery', 'lodash'],
    function (home, RT, $, _) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        let returnValue = {
            document:null,
        };

        return function (context) {
            //home.View.title = txt.appName;
            ctx = context;
            jst = context.jst;
            home.View.actions = null;

            let targetDocument = context.targetDocument;
            let file = context.files[0];
            let model = context.model;
            let refresh = context.refresh;

            let document = {
                id: 0,
                fileName: targetDocument.name,
                fileRemarks: targetDocument.remarks,
                refType: targetDocument.ref_type,
                refExpat: targetDocument.ref_expat ? targetDocument.ref_expat : ctx.refExpat,
                required: targetDocument.required
            }

            let editContext = {
                dismiss: _.noop,
                cancelUpload: _.noop,
                thumbName: null,

                fileName: targetDocument.name,
                fileRemarks: targetDocument.remarks,
                refType: targetDocument.ref_type,
                refExpat: targetDocument.ref_expat ? targetDocument.ref_expat : ctx.refExpat,
                required: targetDocument.required,
                replace: targetDocument
            };

            let setDropProgressText = function (text) {
                if (editContext.dropProgress) {
                    editContext.dropProgress.text(text);
                }
            };

            let newId = 0;

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
                let fileUploadConfirm = result[0];
                let dataCache = {};

                let wideScreen = window.matchMedia("(max-width: 800px)").matches;
                let actions = [
                    {
                        id: 'confirm',
                        label: txt.actionAccept
                    }
                ];
                if (wideScreen) {
                    actions.splice(0, 0, {
                        id: 'documentBtn',
                        label: txt.actionNext,
                        click : function () {
                            $('.thumbPane').addClass('pane-hide');
                            $('.fieldPane').removeClass('pane-hide');
                            $('#documentBtn').addClass('pane-hide');
                            $('#formBtn').removeClass('pane-hide');
                        }
                    });
                    actions.splice(0, 0, {
                        id: 'formBtn',
                        label: txt.actionPrev,
                        click : function () {
                            $('.thumbPane').removeClass('pane-hide');
                            $('.fieldPane').addClass('pane-hide');
                            $('#documentBtn').removeClass('pane-hide');
                            $('#formBtn').addClass('pane-hide');
                        }
                    });
                }
                return RT.Dialog.create({
                    sheet: !wideScreen,
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
                                    _.each(model.documents, function (it) {
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
                            wideScreen : wideScreen,
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
                        $('#documentBtn').addClass('pane-hide');
                        let dataSources = {
                            documentType: [],
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
                                    if (!editContext.fileName) {
                                        editContext.fileName = v.name;
                                        $fileName.val(v.name);
                                    }
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

                        setTimeout("$('#documentType').focus();", 0);
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
                    url: home.Route.expatsStaffDocuments + '0/0/' + targetId,
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
                }).then(function (rs) {
                    return new Promise(function (result, reject) {
                        if (rs.statusCode === 200) {
                            if(rs.data){
                                document.id = rs.data.newId;
                                document.refExpat = editContext.refExpat;
                                document.refType = editContext.refType;
                                document.name = editContext.fileName;
                                document.remarks = editContext.fileRemarks;
                                context.newDocument = document;
                                context.treated = true;
                                console.log('new document uploaded with Id : ' + rs.data.newId);
                                home.View.inactive = false;
                                if (_.isObject(result)) {
                                    home.Badge.invalidate();
                                    if(context.refresh) home.Router.update();
                                }
                            }
                        }
                        else {
                            //console.warn("unexpected response update result: %O", rs);
                            //reject(new Error("HTTP " + rs.statusCode));
                            home.View.inactive = false;
                            context.treated = true;
                            if (_.isObject(result)) {
                                home.Badge.invalidate();
                                if(context.refresh) home.Router.update();
                            }
                        }


                    });
                })['catch'](home.View.rejectHandler);
            }).then(function (result) {
                home.View.inactive = false;
                if (_.isObject(result)) {
                    home.Badge.invalidate();
                    home.Router.update();
                }
                context.treated = true;
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
                        context.treated = true;
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

            return returnValue;
        }


    }
);