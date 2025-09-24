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
					card: "hrContacts"
				};
				var images = {
					user: "ux-user.svg"
				};
				var model = {
					moment: {
						today: moment().startOf("day")
					},
					contacts: {},
					legalNotice: null,
					rerouted: false
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.staffData + home.User.id,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.contacts.SF = _.chain(rs.data.SF)
								.filter(function (it) {
									return !it.archived;
								})
								.orderBy([
									function (it) {
										return it.sn ? it.sn.toLowerCase() : "";
									},
									function (it) {
										return it.gn ? it.gn.toLowerCase() : "";
									},
								]).value();
						}),
						RT.jQuery.get({
							url: home.Route.legalData + home.User.profile,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.legalNotice = rs.data.legalNotice;
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

					var $card = home.View.Pane.content.find('div.card').eq(0);
					$card.find('img.avatar').on('error', function () {
						this.parentElement.innerHTML = images.user.toString();
					});
				}).catch(home.View.rejectHandler);
			}
		};
	}
);