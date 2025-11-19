define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'app/route/documents/DocumentsUploadDialog', 'ckEditor'],

    function (home, RT, $, _, moment, DocumentsUploadDialog, ckEditor) {
        "use strict";


        let ctx = null;
        let jst = null;
        let txt = RT.Text;
        let fmt = RT.Format;

        let dialogContext = {
            treated: true,
            newDocument: {
                id: 0,
                refExpat: 0,
                refType: 0,
                name: 0,
                remarks: 0
            }
        };

        var cachedMoment = RT.Time.createMomentCache();

        return {
            init: function (context) {
                ctx = context;
                jst = context.jst;
            },

            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                home.View.actions = null;
                home.Profile.requireSofime();

                let newDocument = {};

                var tpl = {
                    card: "sfMailItem",
                    recipient: "sfMailItemRecipient",
                    copy: "sfMailItemCopy",
                    hiddenCopy: "sfMailItemHiddenCopy",
                    attachment: "sfMailItemAttachmentForSend",
                    docs: "documents",
                };
                var images = {
                    add: "ux-add.svg",
                    remove: "ux-trash.svg",
                    expand: "ux-circle-down.svg",
                    add_file: "ux-square-add.svg",
                    view: "magnifier.svg"
                };

                let model = {
                    itemId: _.toInteger(path[1]),
                    item: null,
                    rerouted: false,
                    attachments: [],
                    removedIds: [],
                    removedAttachment: [],
                    selectedDocumentForAttachment: null,
                    md: {
                        expatDocuments: null,
                        customerDocuments: null,
                        genericDocuments: null,
                        availableSignatures: null,
                        expat: null
                    },
                    findDocumentTypeById: function (id) {
                        if (!id) return id;
                        return _.find(model.document_type, function (p) {
                            return p.id === id;
                        });
                    },
                    tt: {
                        get expat() {
                            var dataset = _.values(model.md.expat);
                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.sn || "", b.sn || "");
                                if (!x) x = home.Locale.compare(a.gn || "", b.gn || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                getName: _.constant(txt.reloExpatAll)
                            });
                            return dataset;
                        },
                        get availableExpatDocuments() {
                            var dataset = _.values(model.md.expatDocuments);

                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.name || "", b.name || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                name: _.constant(txt.mailAddExpatAttachment)
                            });
                            return dataset;
                        },
                        get availableCustomerDocuments() {
                            var dataset = _.values(model.md.customerDocuments);

                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.name || "", b.name || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                name: _.constant(txt.mailAddCustomerAttachment)
                            });
                            return dataset;
                        },
                        get availableGenericDocuments() {
                            var dataset = _.values(model.md.genericDocuments);

                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.name || "", b.name || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                name: _.constant(txt.mailAddGenericAttachment)
                            });
                            return dataset;
                        },
                        get availableSignatures() {
                            var dataset = _.values(model.md.availableSignatures);
                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.label || "", b.label || "");
                                return x === 0 ? a.id - b.id : x;
                            });

                            //Sort : DefaultFirst
                            dataset.sort(function (a, b) {
                                var aIsDefault = a.isStaffDefault === true ? 1 : 0;
                                var bIsDefault = b.isStaffDefault === true ? 1 : 0
                                return bIsDefault - aIsDefault;
                            });

                            //Sort : Mines first
                            dataset.sort(function (a, b) {
                                var aIsMine = home.User.id === a.staffId ? 1 : 0;
                                var bIsMine = home.User.id === b.staffId ? 1 : 0
                                return bIsMine - aIsMine;
                            });


                            dataset.unshift({
                                id: 0,
                                name: _.constant(txt.mailAddSignature)
                            });

                            return dataset;
                        }
                    }
                };

                if (path.length !== 2 || !_.isSafeInteger(model.itemId) || model.itemId <= 0) {
                    home.View.warn = true;
                    home.View.Pane.content[0].innerHTML = "<code>invalid path</code>";
                    model.rerouted = true;
                    return;
                }
                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.expatsStaffDocuments + '0/' + model.expatId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (result) {
                            model.documentsForSend = result.data;
                        }),
                        RT.jQuery.get({
                            url: home.Route.sfAutoMailOutbox + model.itemId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.item = rs.data.message;
                            model.md.expatDocuments = rs.data.message.availableDocuments.expat;
                            model.md.customerDocuments = rs.data.message.availableDocuments.customer;
                            model.md.genericDocuments = rs.data.message.availableDocuments.generic;
                            model.md.availableSignatures = rs.data.message.availableSignatures;
                            //debugger;
                            /*let recipients = [];
                            let recipientsTo = [];
                            let recipientsCC = [];
                            let recipientsBCC = [];
                            _.each(rs.data.message.recipients, function (r) {
                                if(r.TO){
                                    recipientsTo.push(r);
                                    /*if(r.TO !== "" && r.TO !== " " ){

                                    }*/
                                /*}
                                if(r.CC){
                                    recipientsCC.push(r);
                                    /*if(r.CC !== "" && r.CC !== " " ){

                                    }*/
                                /*}
                                recipientsBCC.push(r);
                                if(r.BCC){
                                    /*if(r.BCC !== "" && r.BCC !== " " ){

                                    }*/
                                /*}
                            });
                            recipientsTo = (recipientsTo) ? recipientsTo : {id: 0, TO: " "};
                            recipientsCC = (recipientsCC) ? recipientsCC : {id: 0, CC: " "};
                            /*let recipientCC = _.find(model.item.recipients, function (r) {
                                return r.CC
                            });

                            recipients = recipientsTo + recipientsCC;*/
                            //model.item.recipients = recipients;

                            if (!model.item.subject) {
                                model.item.subject = "(" + txt.colSubject.toLowerCase() + ")";
                            }

                        }),


                    ])
                ]).then(function (/*result*/) {

                    let documents = model.documentsForSend;
                    let attachDocumentPass = false;
                    RT.Convert.toDate(documents.files, 'ctime');
                    RT.Convert.toDate(documents.files, 'mtime');
                    // documents.files = _.orderBy(documents.files, ['name']);

                    documents.files = documents.files.sort(function (a, b) {

                        var x = home.Locale.compare(a.type && a.type.name || "", b.type && b.type.name || "");
                        if (x === 0) x = home.Locale.compare(a.name || "", b.name || "");
                        return x === 0 ? a.id - b.id : x;
                    });


                    documents.document_type = _.orderBy(documents.document_type, ['default', 'name'], ['asc', 'asc']);

                    model.documentsForSend = documents;
                    model.documents = model.documentsForSend.files;
                    model.document_type = documents.document_type;

                    if (fnHasPathChanged()) {
                        if (!model.rerouted) {
                            console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
                        }
                        return;
                    }

                    function defineRecipientTemplateData(r) {
                        return _.assign({
                            route: home.Route,
                            cachedMoment: cachedMoment,
                            images: images,
                            txt: txt,
                            fmt: fmt,
                            recipient: r
                        }, model);
                    }

                    function defineAttachmentTemplateData(a) {
                        return _.assign({
                            route: home.Route,
                            cachedMoment: cachedMoment,
                            images: images,
                            txt: txt,
                            fmt: fmt,
                            attachment: a
                        }, model);
                    }

                    function removeRecipient(evt) {
                        let $recipient = $(this).closest('.field.recipient');
                        let recipient = toRepicpient($recipient);
                        if (recipient) {
                            if(recipient.address !== ""){
                                RT.Dialog.create({
                                    title: txt.mailRecipient,
                                    sheet: true,
                                    width: 320,
                                    height: 240,
                                    actions: [{
                                        id: "confirm-remove",
                                        label: txt.actionDelete,
                                        classNames: ["warn"]
                                    }],
                                    dismiss: txt.actionCancel,
                                    content: function () {
                                        let escPrompt = _.escape(fmt.sprintf(txt.promptRemoveRecipient, recipient.address));
                                        return '<p>' + escPrompt + '</p>';
                                    }
                                }).then(function (result) {
                                    if (result === "confirm-remove") {
                                        if (recipient.id) {
                                            model.removedIds.push(recipient.id);
                                        }
                                        $recipient.remove();
                                    }
                                }).catch(function (fault) {
                                    console.error("recipient removal fault", fault);
                                    home.View.warn = true;
                                });
                            }
                            else {
                                if (recipient.id) {
                                    model.removedIds.push(recipient.id);
                                }
                                $recipient.remove();
                            }

                        }

                        return RT.jQuery.cancelEvent(evt);
                    }

                    function toTargetDocument($targetDocument) {
                        let targetDocument = {
                            id: $targetDocument.data("mail-id"),
                            name: $targetDocument.data("doc-name").trim(),
                            attachmentId: $targetDocument.data("attachment-id"),
                            source: $targetDocument.data("source").trim(),
                            sourceId: $targetDocument.data("doc-id")

                        };
                        if (!_.isSafeInteger(targetDocument.id) || targetDocument.id < 1) {
                            return null
                        }
                        return targetDocument;
                    }

                    function openDocument(evt) {
                        evt.stopPropagation()
                        let targetDocument = $(this).closest('.attached-doc').data('doc-id');
                        let source = $(this).closest('.attached-doc').data('source');
                        console.log('open : ' + targetDocument + ' ' + source);
                        if (targetDocument && source) {
                            switch (source) {
                                case "expat":
                                    window.open(home.Route.expatsStaffDocuments + '0/0/' + targetDocument + "/print");
                                case "customer":
                                    break;//window.open(home.Route.customerDocuments + '0/0/'  + targetDocument);
                                case "generic":
                                    break;//window.open(home.Route.genericDocuments + '0/0/'  + targetDocument);
                            }
                        }
                    }

                    function removeDocument(evt) {
                        evt.stopPropagation();
                        var $targetDocument = $(this).closest('.attached-doc');
                        var targetDocument = toTargetDocument($targetDocument);
                        if (targetDocument) {
                            /*RT.Dialog.create({
                                title: txt.mailDocument,
                                sheet: true,
                                width: 320,
                                height: 240,
                                actions: [{
                                    id: "confirm-remove",
                                    label: txt.actionDelete,
                                    classNames: ["warn"]
                                }],
                                dismiss: txt.actionCancel,
                                content: function () {
                                    var escPrompt = _.escape(fmt.sprintf(txt.promptRemoveDocument, targetDocument.name));
                                    return '<p>' + escPrompt + '</p>';
                                }
                            }).then(function (result) {
                                if (result === "confirm-remove") {
                                    if (targetDocument) {
                                        model.removedAttachment.push(targetDocument);
                                    }
                                    $targetDocument.remove();
                                    updateAttachmentList();
                                }
                            }).catch(function (fault) {
                                console.error("document removal fault", fault);
                                home.View.warn = true;
                            });*/
                            model.removedAttachment.push(targetDocument);
                            $targetDocument.remove();
                            updateAttachmentList();
                        }

                        return RT.jQuery.cancelEvent(evt);
                    }

                    model.navBack = "#sfMailSend/desc/created/";
                    if (model.item.refExpat) {
                        model.navBack = model.navBack + (model.item.refExpat + '/');
                    }

                    //model.expat = model.md.expat[model.item.refExpat];
                    home.View.warn = false;
                    home.View.documentTitle = model.item.subject;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        defineRecipientTemplateData: defineRecipientTemplateData,
                        defineAttachmentTemplateData: defineAttachmentTemplateData,
                        tpl: tpl,
                        images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));


                    let $card = home.View.Pane.content.find('div.card').eq(0);


                    RT.jQuery.selectOnFocus($card.find('input:text'));

                    let $mailBody = $card.find('div.mb').eq(0);

                    if ($mailBody.length === 1) {
                        $mailBody.on("click", function () {
                            try {
                                var range = document.createRange();
                                range.selectNode(this);
                                var selection = window.getSelection();
                                selection.removeAllRanges();
                                selection.addRange(range);
                            } catch (e) {
                                console.warn("select fault: %O", e);
                            }
                        });
                    }


                    let controls = {
                        attachmentExpatExpand: $card.find('.icon.expat-hook').eq(0),
                        attachmentExpatPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-attachment input.combo-expat').eq(0), {
                            name: "attachmentExpat",
                            identityKey: "sourceId",
                            displayKey: "name",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: (function () {
                                model.attachments = [];
                                $card.find('.attached-doc').each(function () {
                                    var $attachedDoc = $(this);
                                    var attachedDoc = toTargetDocument($attachedDoc);
                                    model.attachments.push(attachedDoc);
                                });

                                var dataset = _.values(model.tt.availableExpatDocuments);
                                dataset = dataset.filter(function (doc) {
                                    return !_.find(model.attachments, function (a) {
                                        return doc.sourceId === a.sourceId;
                                    })

                                });

                                return dataset;
                            }),
                            onOpen: function () {
                                home.jQuery.setTypeAheadValue(controls.attachmentExpatPicker, null);
                            },
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    model.selectedDocumentForAttachment = v;
                                    if (v.sourceId) {
                                        $card.find('.expatButton').addClass('sfMailItemButtonAvailable')
                                            .removeClass('default-primary-color')
                                            .removeClass('text-primary-color');
                                    } else {
                                        $card.find('.expatButton').removeClass('sfMailItemButtonAvailable')
                                            .addClass('default-primary-color')
                                            .addClass('text-primary-color');
                                    }
                                }
                            }
                        }),
                        attachmentCustomerExpand: $card.find('.icon.customer-hook').eq(0),
                        attachmentCustomerPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-attachment input.combo-customer').eq(0), {
                            name: "attachmentCustomer",
                            identityKey: "id",
                            displayKey: "name",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: (function () {
                                model.attachments = [];
                                $card.find('.attached-doc').each(function () {
                                    var $attachedDoc = $(this);
                                    var attachedDoc = toTargetDocument($attachedDoc);
                                    model.attachments.push(attachedDoc);
                                });

                                var dataset = _.values(model.tt.availableCustomerDocuments);
                                dataset = dataset.filter(function (doc) {
                                    return !_.find(model.attachments, function (a) {
                                        return doc.sourceId === a.sourceId;
                                    })

                                });

                                return dataset;
                            }),
                            onOpen: function () {
                                home.jQuery.setTypeAheadValue(controls.attachmentCustomerPicker, null);
                            },
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    model.selectedDocumentForAttachment = v;
                                    if (v.sourceId) {
                                        $card.find('.customerButton').addClass('sfMailItemButtonAvailable')
                                            .removeClass('default-primary-color')
                                            .removeClass('text-primary-color');
                                    } else {
                                        $card.find('.customerButton').removeClass('sfMailItemButtonAvailable')
                                            .addClass('default-primary-color')
                                            .addClass('text-primary-color');
                                    }
                                }
                            }
                        }),
                        attachmentGenericExpand: $card.find('.icon.generic-hook').eq(0),
                        attachmentGenericPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-attachment input.combo-generic').eq(0), {
                            name: "attachmentGeneric",
                            identityKey: "id",
                            displayKey: "name",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: (function () {
                                model.attachments = [];
                                $card.find('.attached-doc').each(function () {
                                    var $attachedDoc = $(this);
                                    var attachedDoc = toTargetDocument($attachedDoc);
                                    model.attachments.push(attachedDoc);
                                });

                                var dataset = _.values(model.tt.availableGenericDocuments);
                                dataset = dataset.filter(function (doc) {
                                    return !_.find(model.attachments, function (a) {
                                        return doc.sourceId === a.sourceId;
                                    })

                                });

                                return dataset;
                            }),
                            onOpen: function () {
                                home.jQuery.setTypeAheadValue(controls.attachmentGenericPicker, null);
                            },
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    model.selectedDocumentForAttachment = v;
                                    if (v.sourceId) {
                                        $card.find('.genericButton').addClass('sfMailItemButtonAvailable')
                                            .removeClass('default-primary-color')
                                            .removeClass('text-primary-color');
                                    } else {
                                        $card.find('.genericButton').removeClass('sfMailItemButtonAvailable')
                                            .addClass('default-primary-color')
                                            .addClass('text-primary-color');
                                    }
                                }
                            }
                        }),
                        signatureExpand: $card.find('.icon.pick-signature').eq(0),
                        signaturePicker: home.jQuery.createTypeAhead($card.find('.combo.pick-signature input.combo').eq(0), {
                            name: "signature",
                            identityKey: "id",
                            displayKey: "label",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: function () {
                                model.signatures = [];
                                return _.values(model.tt.availableSignatures);
                            },
                            onOpen: function () {
                                home.jQuery.setTypeAheadValue(controls.signaturePicker, null);
                            },
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    model.signature = v.filename;
                                    mediate();
                                }
                            }
                        }),
                        restyled: RT.jQuery.restyleInputs($card),
                        sender: $card.find('input[name="am-sender"]'),
                        subject: $card.find('input[name="am-subject"]'),
                        body: $card.find('.am-body').eq(0),

                        addRecpipient: $card.find('.add'),
                        addDocument: $card.find('.add-document')
                    };

                    let text = '';
                    let re1 = /\n\n/;
                    let re2 = /\n/;
                    if(model.item.body){

                        text = model.item.body;
                        let count = 0;
                        while(text.search(re1) !== -1 && count < 256 ){
                            count++;
                            text = text.replace(re1,"</p><p>");//
                        }
                        while(text.search(re2) !== -1 && count < 256 ){
                            count++;
                            text = text.replace(re2,"<br>");//</p><p>
                        }
                        console.log(text);
                        console.log(text.substring(0,3));
                        if(text.substring(0,3) !== '<p>'){
                            text = '<p>' + text + '</p>';
                        }
                        console.log(text);
                    }
                    ckEditor.ClassicEditor.create(document.querySelector('#mailBody'),
                        {
                            licenseKey: 'GPL',
                            fontSize: {
                                options: [
                                    'tiny',
                                    'default',
                                    'big',
                                    'huge'
                                ]
                            },
                            fontColor: {
                                colors: [
                                    {
                                        color: '#ff0000',
                                        label: 'Red'
                                    },
                                    {
                                        color: '#aaaa00',
                                        label: 'Orange'
                                    },
                                    {
                                        color: 'hsl(60, 75%, 60%)',
                                        label: 'Yellow'
                                    },
                                    {
                                        color: 'hsl(90, 75%, 60%)',
                                        label: 'Light green'
                                    },
                                    {
                                        color: '#00ff00',
                                        label: 'Green'
                                    },
                                    // More colors.
                                    // ...
                                ]
                            },
                            plugins: [ckEditor.Autoformat,
                                ckEditor.BlockQuote,
                                ckEditor.Bold,
                                ckEditor.CloudServices,
                                ckEditor.Essentials,
                                ckEditor.Heading,
                                ckEditor.Image,
                                ckEditor.ImageCaption,
                                ckEditor.ImageResize,
                                ckEditor.ImageStyle,
                                ckEditor.ImageToolbar,
                                ckEditor.ImageUpload,
                                ckEditor.Base64UploadAdapter,
                                ckEditor.Indent,
                                ckEditor.IndentBlock,
                                ckEditor.Italic,
                                ckEditor.Link,
                                ckEditor.List,
                                ckEditor.MediaEmbed,
                                ckEditor.Mention,
                                ckEditor.Paragraph,
                                ckEditor.PasteFromOffice,
                                ckEditor.PictureEditing,
                                ckEditor.Table,
                                ckEditor.TableColumnResize,
                                ckEditor.TableToolbar,
                                ckEditor.TextTransformation,
                                ckEditor.Underline,
                                ckEditor.Font,
                                /*Emoji,
                                EmojiPeople,
                                EmojiNature,
                                EmojiPlaces,
                                EmojiFood,
                                EmojiActivity,
                                EmojiObjects,
                                EmojiSymbols,
                                EmojiFlags*/
                            ], // Plugins import.
                            toolbar: ['undo','redo','fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor','bold', 'italic','color','underline','outdent','indent','indentBlock','embed','table','tableToolbar','bulletedList', 'numberedList',/* ... */],
                            height: 240,
                            inline: false,
                            initialData: text

                        }).then(editor => {
                        document.editor = editor;

                    }).catch(error => {
                        console.error(error);
                    });
                    (function () {
                        _.each(["attachmentExpat", "attachmentCustomer", "attachmentGeneric", "signature"], function (k) {
                            var p = controls[k + "Picker"];
                            var x = controls[k + "Expand"];
                            RT.jQuery.selectOnFocus(p.selector);
                            x.on('click', function () {
                                home.jQuery.setTypeAheadValue(p, null);
                                p.selector.focus();
                            });
                        });
                    })();

                    home.jQuery.setTypeAheadValue(controls.attachmentExpatPicker, model.tt.availableExpatDocuments[0]);
                    home.jQuery.setTypeAheadValue(controls.attachmentCustomerPicker, model.tt.availableCustomerDocuments[0]);
                    home.jQuery.setTypeAheadValue(controls.attachmentGenericPicker, model.tt.availableGenericDocuments[0]);

                    var userSignature = null;
                    var staffDefaultSignature = null;
                    var selectedSignature = null;
                    _.each(model.tt.availableSignatures, function (v) {
                        if (v.filename === model.item.signature) {
                            selectedSignature = v;
                            //home.jQuery.setTypeAheadValue(controls.signaturePicker, v);
                            //model.signature = v.filename;
                        }
                        if (v.staffId === home.User.id) {
                            userSignature = v;
                        }
                        if (v.isStaffDefault) {
                            staffDefaultSignature = v;
                        }
                    });
                    if (selectedSignature != null) {
                        home.jQuery.setTypeAheadValue(controls.signaturePicker, selectedSignature);
                        model.signature = selectedSignature.filename;
                    } else if (userSignature != null) {
                        home.jQuery.setTypeAheadValue(controls.signaturePicker, userSignature);
                        model.signature = userSignature.filename;
                    } else if (staffDefaultSignature != null) {
                        home.jQuery.setTypeAheadValue(controls.signaturePicker, staffDefaultSignature);
                        model.signature = staffDefaultSignature.filename;
                    }

                    $card.find('.field.recipient .remove').on('click', removeRecipient);
                    $card.find('.remove-document').on('click', removeDocument);
                    //RT.jQuery.setupHoverClass($card.find('.remove-document')).on('click', removeDocument);

                    let mediate = function (hasChanged = true) {
                        let mreNotEmpty = /^(\w|\.)+@(\w|\.)+\.\w+$/;
                        let mre = /^((\w|\.)+@(\w|\.)+\.\w+)?$/;
                        let canSubmit = true;
                        let canUpdate = hasChanged && !!(controls.subject.val() && document.editor.getData());
                        if (canSubmit) {
                            canSubmit = controls.subject.val() && document.editor.getData();
                        }
                        if (canSubmit) {
                            canSubmit = mreNotEmpty.test(controls.sender.val())
                        }

                        if (canSubmit) {
                            $card.find('.field.recipient').each(function () {
                                let $recipient = $(this);
                                let recipient = toRepicpient($recipient);
                                if (!mre.test(recipient.address)) {
                                    canSubmit = false;
                                }

                            });
                        }

                        RT.jQuery.withClassIf($send, "disabled", !canSubmit);
                        RT.jQuery.withClassIf($update, "disabled", !canUpdate);
                    };


                    function toRepicpient($recipient) {
                        var recipient = {
                            id: $recipient.data("id"),
                            position: $recipient.find('.position').eq(0).val().trim(),
                            address: $recipient.find('.address').eq(0).val().trim()

                        };
                        if (!_.isSafeInteger(recipient.id) || recipient.id < 1) {
                            delete recipient.id;
                        }
                        return recipient;
                    }

                    function updateAttachmentList() {
                        model.attachments = [];
                        $card.find('.attached-doc').each(function () {
                            var $attachedDoc = $(this);
                            var attachedDoc = toTargetDocument($attachedDoc);
                            model.attachments.push(attachedDoc);

                        });
                    }


                    let update = function (evt, action) {
                        //shoot
                        let rq = {
                            action: action,
                            sender: controls.sender.val(),
                            subject: controls.subject.val(),
                            body: document.editor.getData(),
                            signature: model.signature ? model.signature : null,

                            recipients: [],
                            copies:[],
                            hiddenCopies:[],
                            attachements: [],
                            removedIds: model.removedIds,
                            removedAttachment: model.removedAttachment
                        };
                        //rq.body = rq.body.replace("class=\"text-big\"","style=\"font-size:140px\"");
                        //let test = rq.body.replace("Yosr","Pouet");
                        if (action === 'delete') {
                            RT.jQuery.delete({
                                url: home.Route.sfAutoMailOutbox + model.itemId,
                                data: JSON.stringify(rq),
                                contentType: "application/json",
                                dataType: false
                            }).then(function (rs) {
                                return new Promise(function (resolve, reject) {
                                    if (rs.statusCode === 205) {
                                        console.log("mail deleted");
                                    } else {
                                        console.warn("unexpected response delete result: %O", rs);
                                        reject(new Error("HTTP " + rs.statusCode));
                                    }
                                    window.history.back();
                                });

                            }).catch(function (fault) {
                                console.error("mail delete fault", fault);
                                home.View.warn = true;
                            });
                        }

                        if (!$update.hasClass("disabled") || (action === 'send')) {
                            $card.find('.field.recipient').each(function () {
                                var $recipient = $(this);
                                var recipient = toRepicpient($recipient);
                                console.log('recipient :' + JSON.stringify(recipient));
                                rq.recipients.push(recipient);
                            });

                            $card.find('.field.copy').each(function () {
                                var $recipient = $(this);
                                var recipient = toRepicpient($recipient);
                                console.log('recipient :' + JSON.stringify(recipient));
                                rq.copies.push(recipient);
                            });

                            $card.find('.field.hiddenCopy').each(function () {
                                var $recipient = $(this);
                                var recipient = toRepicpient($recipient);
                                console.log('recipient :' + JSON.stringify(recipient));
                                rq.hiddenCopies.push(recipient);
                            });
                            rq.attachements = model.attachments;

                            RT.jQuery.put({
                                url: home.Route.sfAutoMailOutbox + model.itemId,
                                data: JSON.stringify(rq),
                                contentType: "application/json",
                                dataType: false
                            }).then(function (rs) {
                                return new Promise(function (resolve, reject) {
                                    if (rs.statusCode === 205) {
                                        console.log("mail updated");
                                        home.Router.update();
                                    } else {
                                        console.warn("unexpected response update result: %O", rs);
                                        reject(new Error("HTTP " + rs.statusCode));
                                    }
                                });
                            }).catch(function (fault) {
                                console.error("mail update fault", fault);
                                home.View.warn = true;
                            });
                        }
                        return RT.jQuery.cancelEvent(evt);
                    };

                    (function () {
                        var $txt = $card.find('input[type="text"]:not(input[class^="combo"]), input[type="email"], input[type="tel"], textarea');
                        RT.jQuery.trimOnBlur($txt);
                        $txt.on('change', mediate);
                        var $btn = $card.find('a.attachment, .remove, .add');
                        $btn.on('click', mediate);
                        //addRecipient
                        controls.addRecpipient.on('click', function (evt) {
                            let type = $(this).data('type');

                            var fragment = tpl.recipient(defineRecipientTemplateData({id: 0, [type]: " "}));
                            console.log('frag : ' + fragment);
                            let target = '.recipient'+type;
                            let $target = $card.find(target).last();
                            let inserted = {};
                            if($target[0]) {
                                inserted = $(fragment).insertAfter($target);
                            } else {
                                let hook = '.add'+type;
                                inserted = $(fragment).insertBefore($card.find(hook));
                            }
                            //if($target) var inserted = $(fragment).insertAfter($(this).closest('.recipientTO'));
                            /*else*/ //let inserted = $(fragment).insertBefore($(this));
                            //let inserted = $(fragment).insertAfter($(this).closest('.recipientTO'));
                            RT.jQuery.restyleInputs(inserted);
                            inserted.find('.remove').on('click', removeRecipient);

                            var $txt = inserted.find('input[type="text"]');
                            RT.jQuery.selectOnFocus($txt);
                            RT.jQuery.trimOnBlur($txt);

                            return RT.jQuery.cancelEvent(evt);
                        });
                    })();

                    (function () {
                        controls.addDocument.on('click', function (evt) {
                            if (model.selectedDocumentForAttachment != null
                                && model.selectedDocumentForAttachment.hasOwnProperty('sourceId')
                                && ($(this).hasClass('sfMailItemButtonAvailable') || attachDocumentPass)
                            ) {
                                if ($(this).hasClass('sfMailItemButtonAvailable')) {
                                    $(this).removeClass('sfMailItemButtonAvailable')
                                        .addClass('default-primary-color')
                                        .addClass('text-primary-color');
                                }
                                let doc = model.selectedDocumentForAttachment;
                                let fragment = tpl.attachment(defineAttachmentTemplateData(doc));
                                console.log('frag : ' + fragment);
                                let inserted = $(fragment).insertAfter($(this).closest('.attachmentTarget'));

                                RT.jQuery.restyleInputs(inserted);
                                inserted.find('.remove-document').on('click', removeDocument);
                                RT.jQuery.setupHoverClass(inserted.find('.open-document')).on('click', openDocument)

                                let $txt = inserted.find('input[type="text"]');
                                RT.jQuery.selectOnFocus($txt);
                                RT.jQuery.trimOnBlur($txt);
                            }
                            updateAttachmentList();

                            home.jQuery.setTypeAheadValue(controls.attachmentExpatPicker, model.tt.availableExpatDocuments[0]);
                            home.jQuery.setTypeAheadValue(controls.attachmentCustomerPicker, model.tt.availableCustomerDocuments[0]);
                            home.jQuery.setTypeAheadValue(controls.attachmentGenericPicker, model.tt.availableGenericDocuments[0]);

                            return RT.jQuery.cancelEvent(evt);
                        });
                    })();

                    let $cancel = $card.find('.footer a.cancel');
                    $cancel.on('click', function (evt) {
                        update(evt, 'cancel');
                        home.Router.go(["sfMailItem", model.item.id]);
                    });

                    let $update = $card.find('.footer a.update');
                    $update.on('click', function (evt) {
                        update(evt, 'update');
                        home.Router.go(["sfMailItem", model.item.id]);
                    });

                    let $send = $card.find('.footer a.send');
                    $send.on('click', function (evt) {
                        update(evt, 'send');
                        home.Router.go(["sfMessages"]);
                    });

                    let $delete = $card.find('.footer a.delete');
                    $delete.on('click', function (evt) {
                        RT.Dialog.create({
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
                                return '<p>' + txt.dialogMailDeleteConfirm + '</p>';

                            },
                            onDisplay: function ($pane) {


                            },
                            onResolve: function ($pane, id) {
                                if (id === 'confirm') {
                                    update(evt, 'delete');
                                    home.Router.go(["sfMessages"]);
                                }
                            }
                        }).then(function (result) {
                            if (_.isObject(result)) {

                            }
                        })['catch'](home.View.rejectHandler);
                        // });
                        RT.jQuery.cancelEvent(evt);

                    });

                    RT.jQuery.setupHoverClass($card.find('.open-document')).on('click', openDocument)

                    $card.find('[data-action="upload"]').click(function (evt) {
                        let counter = 0;
                        let completed = false;
                        let setNewDocument = function () {
                            counter++;
                            if (dialogContext.newDocument && !completed) {
                                if (dialogContext.newDocument.id !== 0) {
                                    completed = true;

                                    let addedDocument = {
                                        doctype: dialogContext.newDocument.name,
                                        id: 0,
                                        name: dialogContext.newDocument.name,
                                        source: 'expat',
                                        sourceId: dialogContext.newDocument.id,
                                        type: "NA"
                                    }
                                    model.md.expatDocuments.push(addedDocument);

                                    home.jQuery.setTypeAheadValue(controls.attachmentExpatPicker, addedDocument);
                                    model.selectedDocumentForAttachment = addedDocument;
                                    attachDocumentPass = true;
                                    $card.find('.addExpatDocument').click();
                                }
                            }

                            if (counter > 60 || completed === true) {
                                clearInterval(pulse);
                            }
                        }
                        let pulse = setInterval(setNewDocument, 1000);

                        let targetDocument = 0;

                        let $uploadField = $card.find('.dataActionUpload');
                        let $pup = $uploadField.on('change', function (evt) {
                            let files = evt.originalEvent.target.files;
                            if (files.length === 1) {
                                dialogContext = {
                                    targetDocument: targetDocument,
                                    refExpat: model.item.refExpat,
                                    context: ctx,
                                    model: model,
                                    jst: jst,
                                    files: files,
                                    refresh: false
                                }
                            }
                            DocumentsUploadDialog(dialogContext);
                        });
                        $uploadField.click();


                    });


                }).catch(home.View.rejectHandler);
            }
        };
    }
);