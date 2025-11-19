define(
    ['app/home', 'app/RT', 'jquery', 'lodash'],
    function (home, RT, $, _) {
        "use strict";

        var ctx = null;
        var jst = null;
        var txt = RT.Text;
        var fmt = RT.Format;

        var cachedMoment = RT.Time.createMomentCache();

        return {
            init: function (context) {
                debugger;
                ctx = context;
                jst = context.jst;
            },
            invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
                home.View.actions = null;
                home.Profile.requireSofime();

                var tpl = {
                    card: "sfMailSend"
                };
                var images = {
                    expand: "ux-circle-down.svg"
                };
                var model = {
                    outbox: null,
                    md: {
                        expat: null,
                        staff: null
                    },
                    tt: {
                        get expat() {
                            var dataset = _.values(model.md.expat);
                            if (_.isInteger(model.filter.client)) {
                                dataset = _.filter(dataset, function (x) {
                                    return x.client && x.client.id === model.filter.client;
                                });
                            }
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
                        get staff() {
                            var dataset = _.values(model.md.staff);

//                            console.trace("trace du dataset");
//                            console.trace(dataset);

                            dataset = _.filter(dataset, function(x){
                               return x.mail.endsWith("sofime.com") || x.mail.endsWith("somfime.fr");
                            });

                            if (home.User.profile==="CT"){
                                // If user is CT select user as srvmgr
                                dataset = _.filter(dataset, function(x){
                                    return x.id===home.User.id;
                                });
                            }
                            //If user is SF user is only default srvmgr

                            if (_.isInteger(model.filter.client)) {
                                dataset = _.filter(dataset, function (x) {
                                    return x.client && x.client.id === model.filter.client;
                                });
                            }
                            dataset.sort(function (a, b) {
                                var x = home.Locale.compare(a.sn || "", b.sn || "");
                                if (!x) x = home.Locale.compare(a.gn || "", b.gn || "");
                                return x === 0 ? a.id - b.id : x;
                            });
                            // CT users don't get "All" line
                            if (home.User.profile === "SF") {
                                dataset.unshift({
                                    id: 0,
                                    getName: _.constant(txt.reloStaffAll)
                                });
                            }
                            return dataset;
                        }
                    },
                    sort: {
                        asc: null,
                        att: null
                    },
                    filter: {
                        expat : path[3],
                        staff : path[4]
                    },
                    rerouted: false
                };
                (function () {
                    var a = ["created", "model", "subject", "expat", "staff"];
                    var f = model.filter;

//                    model.sort.asc = path[1] === "asc" ? true : path[1] === "desc" ? false : null;
                    model.sort.asc = false;
                    if (!_.isBoolean(model.sort.asc)) model.rerouted = true;

                    model.sort.att = path[2];
                    if (a.indexOf(model.sort.att) < 0) {
                        model.sort.att = null;
                        model.rerouted = true;
                    }

                    _.each(a, function (k) {
                        if (f[k] === "-") {
                            f[k] = null;
                            return; // continue
                        }
                        f[k] = (_.isString(f[k]) && f[k].length > 0) ? _.toInteger(f[k]) : null;
                        if (!_.isSafeInteger(f[k]) || f[k] < 1) {
                            f[k] = null;
                            model.rerouted = true;
                        }
                    });
                })();

                function idParam(v) {
                    return _.isInteger(v) && v > 0 ? v : "-";
                }

                var go = function (o) {
                    var f = ["expat", "staff"];
                    var t = _.assign(_.pick(model.filter, f), _.pick(o, f));
                    home.Router.go([path[0], model.sort.asc === false ? "desc" : "asc", model.sort.att || "created", idParam(t.expat), idParam(t.staff)]);
                };
                if (model.rerouted) {
                    go(model.filter);
                    //return;
                }

                Promise.all([
                    jst.fetchTemplates(tpl),
                    home.Image.Vector.fetchSVG(images),
                    Promise.all([
                        RT.jQuery.get({
                            url: home.Route.sfAutoMailOutbox + "pending/" + idParam(model.filter.expat) + '/' +idParam(model.filter.staff),
                            contentType: false,
                            dataType: "json"
                        }).then(function (rs) {
                            model.md.expat = rs.data.expat;
                            _.each(model.md.expat, function (x) {
                                x.getName = function () {
                                    return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
                                };
                                x.getName = x.getName.bind(x);
                            });
                            model.md.staff = rs.data.staff;
                            _.each(model.md.staff, function (x) {
                                x.getName = function () {
                                    return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
                                };
                                x.getName = x.getName.bind(x);
                            });

                            model.outbox = rs.data.outbox;
                            RT.Convert.toDate(model.outbox, 'created');
                            RT.Convert.toDate(model.outbox, 'mtime');

                        })
                    ])
                ]).then(function (/*result*/) {
                    if (fnHasPathChanged()) {
                        if (!model.rerouted) {
                            console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
                        }
                        return;
                    }
                    //var a = ["created", "model", "subject", "expat"];
                    (function () {
                        function sortBycreated(a, b) {
                            return home.Locale.compare(a.created || "", b.created ||"");
                        }

                        function sortByModel(a, b) {
                            var c1 = a.subject;
                            var c2 = b.subject;
                            return home.Locale.compare(c1 ? c1 : "", c2 ? c2 : "");
                        }
                        function sortBySubject(a, b) {
                            var c1 = a.type;
                            var c2 = b.type;
                            return home.Locale.compare(c1 ? c1.name : "", c2 ? c2.name : "");
                        }

                        function sortByExpat(a, b) {
                            var x = home.Locale.compare(a.expat.sn || "", b.expat.sn || "");
                            if (!x) x = home.Locale.compare(a.expat.gn || "", b.expat.gn || "");
                            return x;
                        }

                        model.outbox.sort(function (a, b) {
                            var x;
                            switch (model.sort.att) {
                                case "created": {
                                    x = sortBycreated(a, b);
                                    if (!x) x = sortByModel(a, b);
                                    if (!x) x = sortByExpat(a, b);
                                    break;
                                }
                                case "model": {
                                    x = sortByModel(a, b);
                                    if (!x) x = sortByExpat(a, b);
                                    if (!x) x = sortBycreated(a, b);
                                    break;
                                }
                                case "subject": {
                                    x = sortBySubject(a, b);
                                    if (!x) x = sortByExpat(a, b);
                                    if (!x) x = sortBycreated(a, b);
                                    break;
                                }
                                case "expat": {
                                    x = sortByExpat(a, b);
                                    if (!x) x = sortBycreated(a, b);
                                    break;
                                }
                                default: {
                                    x = sortByExpat(a, b);
                                    if (!x) x = sortBycreated(a, b);
                                    if (!x) x = sortByModel(a, b);
                                }
                            }
                            if (!x) x = a.id - b.id;
                            if (x !== 0 && !model.sort.asc) x *= -1;
                            return x;
                        });
                    })();



                    home.View.warn = false;
                    home.View.documentTitle = txt.navMailSend;
                    home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
                        user: home.User,
                        route: home.Route,
                        cachedMoment : cachedMoment,
						images: images,
                        txt: txt,
                        fmt: fmt
                    }, model));

                    var $card = home.View.Pane.content.find('div.card').eq(0);
                    var $items = RT.jQuery.setupHoverClass($card.find('article.minicard[data-xt]'));

                    var controls = {
                        expatExpand: $card.find('.icon.pick-expat').eq(0),
                        expatPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-expat input.combo').eq(0), {
                            name: "expat",
                            identityKey: "id",
                            displayKey: "getName",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.expat),
                            onSelect: function (v) {
                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    if (v.id !== model.filter.expat) go({expat: v.id});
                                }
                                else {
                                    setTimeout(setInitial.expat, 10);
                                }
                            }
                        }),
                        staffExpand: $card.find('.icon.pick-staff').eq(0),
                        staffPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-staff input.combo').eq(0), {
                            name: "staff",
                            identityKey: "id",
                            displayKey: "getName",
                            normalize: true,
                            limit: 200,
                            minLength: 0,
                            source: _.constant(model.tt.staff),
                            onSelect: function (v) {

                                if (_.isObject(v) && v.hasOwnProperty("id")) {
                                    if (v.id !== model.filter.staff) go({staff: v.id});
                                }
                                else {
                                    setTimeout(setInitial.staff, 10);
                                }
                            }
                        })
                    };

                    var setInitial = {
                        expat: function () {
                            var v = model.filter.expat ? _.find(model.tt.expat, function (it) {
                                return it.id === model.filter.expat;
                            }) : null;
                            home.jQuery.setTypeAheadValue(controls.expatPicker, v || model.tt.expat[0]);
                        },
                        staff: function () {
                            var v = model.filter.staff ? _.find(model.tt.staff, function (it) {
                                return it.id === model.filter.staff;
                            }) : null;
                            home.jQuery.setTypeAheadValue(controls.staffPicker, v || model.tt.staff[0]);
                        }
                    };

                    (function () {
                        _.each(["expat", "staff"], function (k) {
                            setInitial[k]();
                            var p = controls[k + "Picker"];
                            var x = controls[k + "Expand"];
                            RT.jQuery.selectOnFocus(p.selector);
                            x.on('click', function () {
                                home.jQuery.setTypeAheadValue(p, null);
                                p.selector.focus();
                            });
                        });
                    })();

                    var toItem = function ($el) {
                        if ($el.tagName !== "ARTICLE") {
                            $el = $el.closest('article');
                        }
                        var id = $el.data("id");
                        if (_.isInteger(id) && model.outbox) {
                            return _.find(model.outbox, function (it) {
                                return it.id === id;
                            });
                        }
                        return null;
                    };

                    $items.on('click', function (evt) {
                        var itemId = $(this).data("xt");
                        if (!_.isInteger(itemId) || itemId < 1) {
                            throw new Error("data-xt");
                        }
                        home.Router.go(["sfMailItem", itemId]);
                    });

                    $card.find('th.sortable[data-col]').on('click', function () {
                        var $th = $(this);
                        var att = $th.data("col");
                        var p = path.slice();
                        p[1] = model.sort.asc && model.sort.att === att ? "desc" : "asc";
                        p[2] = att;
                        home.Router.go(p);
                    });

                }).catch(home.View.rejectHandler);
            }
        };
    }
);