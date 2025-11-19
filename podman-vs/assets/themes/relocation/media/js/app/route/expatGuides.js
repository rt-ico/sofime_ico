define(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var ctx = null;
		var jst = null;
		var txt = RT.Text;
		var fmt = RT.Format;

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                var tpl = {
                    guides: null
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
                    download: "ux-download.svg"
                };

                var model = {
                    documents : [],
                    thumb: home.Image.Thumb.a4portrait,
                    findDocumentTypeById : function (id) {
                        if (!id) return id;
                        return _.find(model.documents.document_type, function (p) {
                            return p.id === id;
                        });
                    },
                    findDocumentById : function (id) {
                        if (!id) return id;
                        return _.find(model.documents.files, function (p) {
                            return p.id === id;
                        });
                    }
                };

                Promise.all([
                    Promise.all([
                        jst.template("expatGuides"),
                        RT.jQuery.get({
                            url: home.Route.genericsDocuments,
                            contentType: false,
                            dataType: "json"
                        }),
                        home.Image.Vector.fetchSVG(images)
                    ]).then(function (result) {
                        tpl.guides = result[0];
                        var documents = result[1].data;

                        RT.Convert.toDate(documents.files, 'ctime');
                        RT.Convert.toDate(documents.files, 'mtime');
                        documents.files = _.orderBy(documents.files, ['name']);

                        model.documents = documents;
                    })
                ]).then(function (/*result*/) {
                    if (fnHasPathChanged()) {
                        console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
                        return;
                    }

                    home.View.Pane.content[0].innerHTML = tpl.guides(_.assign({
                        txt: txt,
                        fmt: fmt,
                        images: images,
                        route: home.Route
                    }, model));

                    var $card = $('#ExpatGuidesCard');
                    var $thumbsPane = $card.find('.document-cards');
                    var $thumbItems = $thumbsPane.find('.document-card');

                    $thumbsPane.find('[data-action="download"]').click(function (evt) {
                        evt.stopPropagation();
                        var id = $(this).closest('.document-card[data-file]').data('file');
                        console.log('id ' + id);
                        var targetDocument = model.findDocumentById(id);
                        if (targetDocument) {
                            window.open(home.Route.genericsDocuments + targetDocument.id + "/original?mtime" + targetDocument.mtime.getTime(), "_self");
                        }
                    });

                    $thumbsPane.find('[data-action="open"]').click(function (evt) {
                        evt.stopPropagation();
                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        if (targetDocument) {
                            window.open(home.Route.genericsDocuments + targetDocument.id + "/print?mtime" + targetDocument.mtime.getTime(), "_blank");
                        }
                    });

                    $thumbsPane.find('[data-action="print"]').click(function (evt) {
                        evt.stopPropagation();
                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        if (targetDocument) {

                            var type = targetDocument.thumb.type === 'application/pdf' ? 'pdf' : 'image';
                            console.log('url :' + home.Route.genericsDocuments + targetDocument.id + '/print?mtime' + '/ type :' + targetDocument.thumb.type);
                            printJS({
                                printable:home.Route.genericsDocuments + targetDocument.id + '/print?mtime',
                                type: type,
                                showModal:true
                            });

                        }
                    });

                    $thumbsPane.find('[data-action="showinfo"]').click(function (evt) {
                        evt.stopPropagation();
                        var targetDocument = model.findDocumentById($(this).closest('.document-card[data-file]').data('file'));
                        if (targetDocument) {
                            Promise.all([
                                jst.template('docInfo')
                            ]).then(function (result) {
                                var docInfo = result[0];
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
                                    title: txt.dialogDocumentInfoTitle,
                                    dismiss: txt.actionClose,
                                    content: function () {
                                        return $(docInfo({
                                            fmt: fmt,
                                            txt: txt,
                                            thumb: home.Image.Thumb.a4portrait,
                                            route: home.Route,
                                            documentUri: home.Route.genericsDocuments,
                                            dataChoices: dataChoices
                                        }));
                                    },
                                    onDisplay: function ($pane) {
                                        RT.jQuery.selectOnFocus($pane.find('input[type=text]'));

                                        var $fileName = $('#fileName');
                                        var $fileRemarks = $('#fileRemarks');
                                        var $documentType = $('#documentType');
                                        var $confirm = $pane.find('#confirm');

                                        $documentType.val(model.findDocumentTypeById(dataChoices.ref_type).name);
                                        $documentType.prop('disabled', true);

                                        $fileName.val(dataChoices.name);
                                        $fileRemarks.val(dataChoices.remarks);

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
                                        url: home.Route.genericsDocuments + result.id,
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
			}
		};
	}
);