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
				//home.View.title = txt.appName;
				home.View.actions = null;

				var tpl = {
					contacts: "expatContacts"
				};
				var images = {
					user: "ux-user.svg"
				};
				var model = {
					validatedServices: null,
					services: null,
					welcomer: null,
					contacts: null
				};

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.expatHome,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.services = rs.data.services;
							model.contacts = rs.data.contacts;
							model.validatedServices = _.chain(rs.data.validatedServices)
								.map(function (vs) {
									if (vs.service) vs.service = model.services[vs.service];
									if (vs.contact) vs.contact = model.contacts[vs.contact];
									if (vs.supplier) vs.supplier = rs.data.suppliers[vs.supplier];
									return vs;
								}).filter(function (vs) {
									return !!(vs.service && !vs.service.internal);
								}).value().sort(function (a, b) {
									var x = 0;
									if (a.service && b.service) {
										x = a.service.name < b.service.name ? -1 : a.service.name > b.service.name ? 1 : 0;
									}
									return x !== 0 ? x : a.id - b.id;
								});

							if (rs.data.welcomer) {
								model.welcomer = rs.data.contacts[rs.data.welcomer];
							}

							model.contacts = _.chain(model.contacts)
								.filter(function (it) {
									return (_.isArray(it.services) && it.services.length) || (model.welcomer && it.id === model.welcomer.id);
								})
								.orderBy([
									function (it) {
										return it.sn ? it.sn.toLowerCase() : "";
									},
									function (it) {
										return it.gn ? it.gn.toLowerCase() : "";
									},
								]).value();
						})
					])
				]).then(function (/*result*/) {
					if (fnHasPathChanged()) {
						console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						return;
					}
					debugger;
					home.View.Pane.content[0].innerHTML = tpl.contacts(_.assign({
						user: home.User,
						route: home.Route,
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