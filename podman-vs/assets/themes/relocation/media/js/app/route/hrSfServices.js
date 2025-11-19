define(
    ['app/home', 'app/RT', 'jquery', 'lodash', 'moment'],
    function (home, RT, $, _, moment) {
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
                home.Profile.require("HR");
                home.View.actions = null;

                var tpl = {
                    card: "hrSfServices"
                };
                var images = {
                    expand: "ux-circle-down.svg",
                    contract: "ux-circle-up.svg"
                };
                var model = {
                    moment: {
                        today: moment().startOf("day")
                    },
                    rerouted: false
                };

                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.masterData,
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.serviceCategory = rs.data.serviceCategory;
                            var services = rs.data.service;
                            _.each(services, function(service) {
                                var split = _.escape(service.localeDescHr).split(/\r?\n/);
                                var msg = [];

                                var listMode = false;
                                _.each(split, function (line) {
                                    if (line.search(/^(\s)*\*.*$/) > -1) {
                                        //line mode
                                        if (!listMode) {
                                            listMode = true;
                                            msg.push('<ul>');
                                        }
                                        var replaceLine = line.replace(/^(\s)*\*/, '');
                                        msg.push('<li>' + replaceLine + '</li>');
                                    } else {
                                        if (listMode) {
                                            listMode = false;
                                            msg.push('</ul>');
                                        }
                                        msg.push(line);
                                    }
                                });
                                //closing list if not closed
                                if (listMode) {
                                    listMode = false;
                                    msg.push('</ul>');
                                }
                                service.htmlDesc = msg;
                            });
                            model.service = services;

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
                        images: images,
                        //tpl: tpl,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    var $card = home.View.Pane.content.find('.sf-services');
                    $card.find('.relocation-desc-card-expand').click(function (evt) {
                        evt.stopPropagation();


                        var $card = $(this).closest('.relocation-desc-card');
                        if ($card.hasClass('relocation-desc-card-closed')) {
                            $card.removeClass('relocation-desc-card-closed').addClass('relocation-desc-card-open');
                        }
                        else {
                            $card.removeClass('relocation-desc-card-open').addClass('relocation-desc-card-closed');
                        }
                    });

                }).catch(home.View.rejectHandler);
            }
        };
    }
);