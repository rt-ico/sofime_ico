define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment', 'ckEditor'],
    function (home, RT, $, _, moment,ckEditor) {
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

                var tpl = {
                    card: "sfMailItemSent",
                    recipient: "sfMailItemRecipient",
                    attachment: "sfMailItemAttachment"
                };
                var images = {
                    add: "ux-add.svg",
                    remove: "ux-trash.svg",
                    expand: "ux-circle-down.svg"
                };
                var model = {
                    itemId: _.toInteger(path[1]),
                    item: null,
                    rerouted: false,
                    attachments : [],
                    removedIds : [],
                    removedAttachment : [],
                    selectedDocumentForAttachment : null,
                    md: {
                        expatDocuments: null,
                        customerDocuments: null,
                        genericDocuments: null,
                        availableSignatures: null
                    },
                    tt: {
                        get availableExpatDocuments() {
                            var dataset = _.values(model.md.expatDocuments);

                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.name || "", b.name || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                            dataset.unshift({
                                id: 0,
                                doctype: _.constant(txt.mailAddExpatAttachment)
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
                                doctype: _.constant(txt.mailAddCustomerAttachment)
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
                                doctype: _.constant(txt.mailAddGenericAttachment)
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
                                var aIsDefault = a.isStaffDefault===true?1:0;
                                var bIsDefault = b.isStaffDefault===true?1:0
                                return bIsDefault-aIsDefault;
                            });

                            //Sort : Mines first
                            dataset.sort(function (a, b) {
                                var aIsMine = home.User.id===a.staffId?1:0;
                                var bIsMine = home.User.id===b.staffId?1:0
                                return bIsMine-aIsMine;
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
                            url: home.Route.sfAutoMailOutbox + model.itemId,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.item = rs.data.message;
                            model.md.expatDocuments = rs.data.message.availableDocuments.expat;
                            model.md.customerDocuments = rs.data.message.availableDocuments.customer;
                            model.md.genericDocuments = rs.data.message.availableDocuments.generic;
                            model.md.availableSignatures = rs.data.message.availableSignatures;


                            let recipients = [];
                            let recipientTo  = _.find(model.item.recipients, function(r) { return r.TO });
                            recipientTo = (recipientTo) ? recipientTo : { id : 0, TO : " " };
                            let recipientCC  = _.find(model.item.recipients, function(r) { return r.CC });
                            recipientCC = (recipientCC) ? recipientCC : { id : 0, CC : " " };
                            recipients.push(recipientTo);
                            recipients.push(recipientCC);
                            _.each(model.item.recipients, function (r) {
                                if (r.BCC || r.BCC === "") {
                                    recipients.push(r);
                                }
                            });

                            model.item.recipients = recipients;

                            if (!model.item.subject) {
                                model.item.subject = "(" + txt.colSubject.toLowerCase() + ")";
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


                    function toTargetDocument($targetDocument) {
                        let targetDocument = {
                            id: $targetDocument.data("mail-id"),
                            name: $targetDocument.data("doc-name").trim(),
                            attachmentId : $targetDocument.data("attachment-id"),
                            source: $targetDocument.data("source").trim(),
                            sourceId: $targetDocument.data("doc-id")

                        };
                        if (!_.isSafeInteger(targetDocument.id) || targetDocument.id < 1) {
                            return null
                        }
                        return targetDocument;
                    }
                    model.navBack = "#sfMailSent/desc/created/";
                    if(model.item.refExpat){
                        model.navBack = model.navBack + (model.item.refExpat + '/');
                    }
                    home.View.warn = false;
                    home.View.documentTitle = model.item.subject;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment: cachedMoment,
                        defineRecipientTemplateData : defineRecipientTemplateData,
                        defineAttachmentTemplateData : defineAttachmentTemplateData,
                        tpl:tpl,
                        images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    let $card = home.View.Pane.content.find('div.card').eq(0);

                    RT.jQuery.selectOnFocus($card.find('input:text'));

                    let $mailBody = $card.find('div.mb').eq(0);
                    let text = '';
                    let re = /\n/;
                    if(model.item.body){

                        text = model.item.body;
                        let count = 0;
                        while(text.search(re) !== -1 && count < 256 ){
                            count++;
                            text = text.replace(re,"</p><p>");
                        }
                        text = '<p>' + text + '</p>';
                        console.log(count)
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
                            ], // Plugins import.                            height: 240,
                            inline: false,
                            isReadOnly: true,
                            initialData: text

                        }).then(editor => {
                        editor.enableReadOnlyMode("editor");

                    }).catch(error => {
                        console.error(error);
                    });

                    let controls = {

                        sender: $card.find('input[name="am-sender"]'),
                        subject: $card.find('input[name="am-subject"]'),
                        body : $card.find('.am-body').eq(0),

                    };

                    let userSignature = null;
                    let staffDefaultSignature = null;
                    let selectedSignature = null;


                    var mediate = function (hasChanged = true) {
                        var mreNotEmpty = /^(\w|\.)+@(\w|\.)+\.\w+$/;
                        var mre = /^((\w|\.)+@(\w|\.)+\.\w+)?$/;
                        var canSubmit = true;
                        var canUpdate = hasChanged && !!(controls.subject.val() && controls.body.val());

                        if (canSubmit) {
                            canSubmit = !!(controls.subject.val() && controls.body.val());
                        }
                        if (canSubmit) {
                            canSubmit = mreNotEmpty.test(controls.sender.val())
                        }

                        if (canSubmit) {
                            $card.find('.field.recipient').each(function () {
                                var $recipient = $(this);
                                var recipient = toRepicpient($recipient);
                                if (!mre.test(recipient.address)) {
                                    canSubmit = false;
                                }

                            });
                        }

                    };

                    function toRepicpient($recipient) {
                        let recipient = {
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
                            let $attachedDoc = $(this);
                            let attachedDoc = toTargetDocument($attachedDoc);
                            model.attachments.push(attachedDoc);

                        });
                    }
                    let update = function (evt, action) {
                        let rq = {
                            action : action,
                            sender: model.item.sender,
                            subject: model.item.subject,
                            body: model.item.body,
                            refExpat: model.item.refExpat,
                            autoMailType: model.item.autoMailType,
                            refMountPoint: model.item.refMountPoint,
                            refStaffServiceManager: model.item.refStaffServiceManager,
                            signature: model.signature ? model.signature : null,

                            recipients: [],
                            attachments: [],
                            removedIds: null,
                            removedAttachment : null
                        };


                        if (action === 'resend') {
                            $card.find('.field.recipient').each(function () {
                                var $recipient = $(this);
                                var recipient = toRepicpient($recipient);
                                console.log('recipient :' + JSON.stringify(recipient));
                                rq.recipients.push(recipient);
                            });

                            $card.find('.attached-doc').each(function () {
                                let $attachedDoc = $(this);
                                let attachedDoc = toTargetDocument($attachedDoc);
                                rq.attachments.push(attachedDoc);
                            });

                            RT.jQuery.put({
                                url: home.Route.sfAutoMailResend + model.itemId,
                                data: JSON.stringify(rq),
                                contentType: "application/json",
                                dataType: false
                            }).then(function (rs) {
                                return new Promise(function (resolve, reject) {
                                    if (rs.statusCode === 200) {
                                        console.log("mail resent");
                                        home.Router.go(["sfMailItem", rs.data.reSentMailId]);
                                    }
                                    else {
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

                    let $back = RT.jQuery.setupHoverClass($card.find('.footer a.back'));
                    $back.on("click", function (evt) {
                        window.history.back();
                        return RT.jQuery.cancelEvent(evt);
                    });


                    let $send = RT.jQuery.setupHoverClass($card.find('.footer a.resend'));
                    $send.on('click', function(evt) {
                        update(evt, 'resend');
                    });


                    mediate(false);
                }).catch(home.View.rejectHandler);
            }
        };
    }
);