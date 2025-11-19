requirejs(
	['app/home', 'app/RT', 'jquery', 'lodash'],
	function (home, RT, $, _) {
		"use strict";

		var txt = RT.Text;
		var fmt = RT.Format;

		try {
			var context = home.Router.defineRouteContext({
				jst: home.createDeferredTemplateCache(),
				dialogs: home.Dialog.createDeferredDialogCache(function () {
					return context;
				}, [
					"editPhoto",
					"editFile"
				])
			});

			switch (home.User.profile) {
				case "SF":
				case "CT": {
					home.Router.defineRoutes([
						"sfTodo",
						"sfMemo",
						"sfExpatView",
						"sfExpatEdit",
						"sfExpatVisit",
						"sfExpatVisitPlace",
						"sfExpatVisitPlaceEdit",
						"sfExpatDocs",
						"sfExpatHomeSearch",
						"sfExpatHomeSettle",
						"sfExpatSocialSecurity",
						"sfExpatImmigration",
						"sfExpatRelocationInfo",
						"sfExpatRelocationCreate",
						"sfSuppliers",
						"sfSupplierContactEdit",
						"sfMessages",
						"sfMailItem",
						"sfMailItemSent",
						"sfMailSend",
						"sfMailSendGrouped",
						"sfMailSent",
						"sfStatistics",
						"sofimeExpats",
						"activeSurveys",
						"reviewSurveys",
						"visits"
					]);
					break;
				}
				case "HR": {
					home.Router.defineRoutes([
						"hrAccount",
						"hrHome",
						"hrPlanning",
						"hrReloSetup",
						"hrReloTrack",
						"hrSfServices",
						"hrStats",
                        "hrVisits",
						"hrContacts"
					]);
					break;
				}
				default: {
					home.Router.defineRoutes([
						"expatMain",
						"expatAccount",
						"expatRelocation",
						"expatSurveys",
						"expatDocs",
						"expatGuides",
						"expatVisits",
						"otherVisits",
						"expatContacts",
						"visits",
						"welcome"
					]);

					// contextmenu to reset "welcome wizard", or to force access to default dashboard
					home.View.Pane.sidebar.find('li.expatMain').contextmenu(function (evt) {
						RT.jQuery.cancelEvent(evt);

						var $el = $(this);
						var offset = $el.offset();
						var popupItems = [{
							id: "showDashboard",
							label: txt.welcomeDashboard
						}];
						if (home.View.Options.enableWelcomeReset) {
							popupItems.push({
								id: "resetWelcome",
								label: txt.welcomeReset
							});
						}
						RT.Popup.create({
							width: Math.max(280, $el.outerWidth()),
							height: 0,
							top: offset.top,
							left: offset.left,
							title: txt.navHome,
							items: popupItems
						}).then(function (result) {
							if (_.isString(result.id)) {
								switch (result.id) {
									case "showDashboard": {
										home.Router.go(["expatMain", "dashboard"]);
										break;
									}
									case "resetWelcome": {
										RT.jQuery.post({
											url: home.Route.welcomeExpat,
											data: JSON.stringify({
												reset: true
											}),
											contentType: "application/json",
											dataType: false
										}).then(function (rs) {
											console.log("expat(%s): reset welcome steps (%s).", home.User.id, rs.statusCode);
											if (home.Router.path[0] === "welcome") {
												home.Router.update();
											}
											else {
												home.Router.go(["welcome"]);
											}
										});
									}
								}
							}
							return result;
						}).catch(home.View.rejectHandler);

						return false;
					});
				}
			}

			// initialize on load
			$(function () {
				// activate CSS styles requiring JS interaction
				$('html').eq(0).addClass('js-enabled');

				var $body = $(document.body);
				var $pane = home.View.Pane;

				// hide splash
				(function () {
					var $splash = $body.find('div.splash').removeClass('opaque').addClass('transparent');
					setTimeout(function () {
						$splash.remove();
					}, 500); // css trans: 0.5
				})();

				// activate sidebar nav links
				RT.jQuery.setupHoverClass($pane.sidebar.find('ul.nav-menu > li:not(.separator)')).click(
					function () {
						if (!home.View.isWideDisplay) {
							$body.removeClass("with-nav");
						}
						location.href = $(this).find('a').attr('href');
						return false;
					}
				).on('keyup', home.jQuery.keyToClick);

				// activate sidebar show/hide toggle
				$pane.sidebar.add($pane.header).find('img.sidebar-toggle').closest('a').click(
					function () {
						var $a = $(this);
						var href = $a.attr('href');
						if ("#minimize" === href) {
							$body.removeClass("with-nav");
						}
						else if ("#maximize" === href) {
							$body.addClass("with-nav");
						}
						return false;
					}
				);

				// activate layout
				$body.addClass("with-header");
				if (home.View.isWideDisplay) {
					$body.addClass("with-nav");
				}

				if (home.User.expat) {
					RT.jQuery.get({
						url: home.Route.accountExpat,
						contentType: false,
						dataType: "json"
					}).then(function (rs) {
						return new Promise(function (/*resolve, reject*/) {
							var w = rs.data.welcome;
							if (w.stage && !w.done) {
								console.log("expat(%s): welcome incomplete: %s", home.User.id, w.stage);
								location.hash = "#welcome";
							}
							home.Router.activate();
						});
					}).catch(home.View.rejectHandler);
				}
				else {
					home.Router.activate();
				}
			});
		} catch (fault) {
			console.error("init: failed", fault);
		}
	}
);