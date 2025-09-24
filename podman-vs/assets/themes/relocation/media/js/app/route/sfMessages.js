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
				home.View.actions = null;
				home.Profile.requireSofime();

				var tpl = {
					card: "sfMessages"
				};
				var model = {
					tiles: [{
						uri: "#sfMailSend",
						label: txt.navMailSend
					}, {
						uri: "#sfMailSent",
						label: txt.navMailSent
					}, {
						uri: "#sfMailSendGrouped",
						label: txt.navMailSendGrouped
					}]
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							//model.xxx = rs.data.xxx;
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
					home.View.documentTitle = txt.navSfMessages;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);
					var $tiles = $card.find('article.sf-tile');
					RT.jQuery.setupHoverClass($tiles).on('click', function (evt) {
						var $el = $(this);
						var $a = this.tagName === "A" ? $el : $el.find('a[href]');
						location.href = $a.attr('href');
						return RT.jQuery.cancelEvent(evt);
					});

				}).catch(home.View.rejectHandler);
			}
		};
	}
);