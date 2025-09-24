define(
	['app/RT', 'app/hashChange', 'text!routes/routes.json', 'jquery', 'lodash', 'moment', 'typeahead','chart', 'Handlebars'],
	function (RT, HC, routes, $, _, moment, typeahead, chart,Handlebars) {
		"use strict";

		//var txt = RT.Text;
		//var fmt = RT.Format;

		moment.locale('fr');

		var $route = JSON.parse(routes);
		var $badge = {
			state: null,
			staleTime: 0,
			updating: false,
			updateListeners: [],
			setStaleTime: function (offset) {
				$badge.staleTime = new Date().getTime() + Math.max(0, offset);
			},
			markStale: function () {
				console.log("badge: invalidating...");
				$badge.setStaleTime(0);
			},
			markFresh: function () {
				$badge.setStaleTime(60000 * 5);
			},
			visibilityChanged: function () {
				if (document.hidden === false && $badge.staleTime > 0) {
					$badge.markStale();
				}
			},
			updateAsync: function () {
				setInterval($badge.update, 1000);
			},
			update: function () {
				if ($badge.updating || new Date().getTime() < $badge.staleTime) return;
				if (!_.isUndefined(document.hidden) && document.hidden) return;

				$badge.updating = true;
				var done = function (result) {
					$badge.state = _.isObject(result) ? result : null;
					$badge.updating = false;
					$badge.markFresh();
					if ($badge.state) {
						_.each(_.keys(result), function (k) {
							var it = result[k];
							if (!_.isNumber(it)) it = 0;
							var $b = $home.View.Pane.sidebar.find('.' + k + ' .badge');
							if ($b.length === 1) {
								$b.text(it.toString());
								if (it > 0) {
									$b.removeClass('zero');
								}
								else {
									$b.addClass('zero');
								}
							}
						});
					}
					else {
						$('.badge').addClass('zero');
					}

					for (var i = 0; i < $badge.updateListeners.length; i++) {
						$badge.updateListeners[i]();
					}
				};

				RT.jQuery.get({
					url: $home.Route.badge,
					contentType: false,
					dataType: "json"
				}).then(function (result) {
					done(result.data);
				}).catch(function (fault) {
					done();
					console.warn("badge: " + RT.Diagnostics.toNetworkErrorMessage(fault));
				});
			}
		};

		if (!_.isUndefined(document.hidden)) {
			document.addEventListener('visibilitychange', $badge.visibilityChanged, false); // tab focus
		}

		var $home = {
			User: $route.user,
			Profile: {
				require: function (profileCode) {
					if (!_.isString(profileCode) || !profileCode.length) {
						throw new Error("invalid profileCode: " + profileCode);
					}
					if (!(profileCode === $route.user.profile)) {
						throw new Error("forbidden: " + $route.user.profile);
					}
					if (profileCode === "HR" && !_.isObject($route.user.client)) {
						throw new Error("forbidden: (customer undefined)");
					}
				},
				requireSofime: function () {
					if (!$route.user.staff || (!_.isString($route.user.profile) || ["SF", "CT"].indexOf($route.user.profile) < 0)) {
						throw new Error("forbidden: " + $route.user.profile);
					}
				}
			},
			Route: $route.uri,
			Router: (function () {
				var routeContext = null;
				var routeCache = {};
				var closeCache = {};
				var activated = false;

				function verifyRouteName(routeName) {
					if (!_.isString(routeName)) {
						throw new TypeError("routeName: string expected");
					}
					if (routeCache.hasOwnProperty(routeName)) {
						throw new Error("routeName conflict: " + routeName)
					}
					return routeName;
				}

				function createRoute(routeName, route) {
					var delegate;
					if (_.isFunction(route)) {
						delegate = new Promise(function (resolve) {
							resolve(route);
						});
					}
					else {
						if (!_.isObject(routeContext)) {
							throw new Error("routeContext unset");
						}
						delegate = function () {
							return new Promise(function (resolve, reject) {
								requirejs(['app/route/' + routeName], function (route) {
									var fnInit = route["init"];
									if (!_.isFunction(fnInit)) {
										reject(new TypeError("route::init: " + routeName));
									}
									var fnInvoke = route["invoke"];
									if (!_.isFunction(fnInvoke)) {
										reject(new TypeError("route::invoke: " + routeName));
									}
									fnInit(routeContext);
									if (_.isFunction(route["close"])) {
										closeCache[routeName] = route["close"];
									}
									resolve(fnInvoke);
								});
							});
						};
					}
					routeCache[routeName] = delegate;
				}

				function updateRoute(evt) {
					try {
						$home.Charts.clear();
						$home.title = null;

						var hash = $home.Router.hash;
						if (!hash) {
							$home.Router.goDefaultHashUri();
							return;
						}

						var path = $home.Router.path;
						var routeName = path[0];
						var oldPath = evt ? $home.Router.urlToPath(evt.oldURL) : [];
						var oldRouteName = oldPath && oldPath.length ? oldPath[0] : null;
						var sameRoute = path.length > 0 && oldPath.length > 0 && routeName === oldRouteName;
						if (!sameRoute) {
							document.title = RT.Text.appName;
							$home.search = null;

							if (oldRouteName && oldRouteName.length && routeCache.hasOwnProperty(oldRouteName)) {
								console.log("updating route: %s => %s", oldRouteName, routeName);
								var closeDelegate = closeCache[oldRouteName];
								if (_.isFunction(closeDelegate)) {
									try {
										closeDelegate(path, oldPath);
									} catch (fault) {
										console.error("updateRoute: %O", fault);
									}
								}
							}
						}

						if (routeCache.hasOwnProperty(routeName)) {
							var delegate = routeCache[routeName];
							if (_.isFunction(delegate)) {
								console.log("defining route: %s", routeName);
								delegate = delegate(); // define Promise lazily
								routeCache[routeName] = delegate;
							}

							$home.View.warn = false;
							var fnHasPathChanged = function () {
								return !_.isEqual(path, $home.Router.path);
							};

							delegate.then(function (route) {
								route(path, oldPath, sameRoute, fnHasPathChanged);
							}).catch(function (fault) {
								console.error("route fault: %s", hash, fault);
							});
							return;
						}

						$home.View.warn = true;
						RT.Diagnostics.showErrorAlert(RT.Text.featureNameError + "\n\n#" + hash);
					} catch (e) {
						$home.View.warn = true;
						RT.Diagnostics.showErrorAlert(e);
					}
				}

				return {
					/**
					 * Activates the router, binding it to "hashchange" events.
					 */
					activate: function () {
						if (activated) {
							throw new Error("router: already activated");
						}
						activated = true;

						HC.addHashChange(updateRoute);
						updateRoute();
					},
					go: function (path) {
						var h = "#" + path.join("/");
						location.hash = h;
						return h;
					},
					goDefaultHashUri: function () {
						var uri = $home.View.Pane.sidebar.find('ul.nav-menu li:not(.non-default) a[href^="#"]').eq(0).attr('href');
						if (uri !== location.hash) {
							location.hash = uri;
						}
					},
					/**
					 * Triggers a refresh of the current route, without changing the location hash.
					 * The route can refresh the user interface, for example after updating data.
					 */
					update: function () {
						updateRoute();
					},
					/**
					 * Defines a context object, made available to routes, for sharing data and code.
					 * @param {object} context an object.
					 * @returns {object} the supplied object, for chaining.
					 */
					defineRouteContext: function (context) {
						if (!_.isObject(context)) {
							throw new TypeError("routeContext: object expected");
						}
						return (routeContext = context);
					},
					/**
					 * Defines an array of one or more unique deferred routes.
					 * @param {string[]} routeNames each name must match a source file under app/route/mode, invoked as an AMD module when matched against the location hash.
					 */
					defineRoutes: function (routeNames) {
						if (_.isEmpty(routeNames) || !_.isArray(routeNames)) {
							var msg = "invalid route definitions";
							console.error("%s: %O", msg, routeNames);
							throw new Error(msg);
						}
						routeNames = _.uniq(routeNames);
						_.each(routeNames, verifyRouteName);
						_.each(routeNames, createRoute);
					},
					/**
					 * Defines a single deferred or already-resolved route.
					 * @param {string} routeName used to select the route when matching location hash.
					 * @param {function} [route] if defined, invoked directly for route; if undefined, the route will be deferred to a matching AMD module.
					 */
					defineRoute: function (routeName, route) {
						createRoute(verifyRouteName(routeName), route);
					},
					get hash() // hash, without "#", unparsed; or empty
					{
						var h = location.hash;
						if (h.length < 2 || h.charAt(0) !== "#") return "";
						return h.substring(1);
					},
					get path() // hash, split into path-like array
					{
						var h = $home.Router.hash;
						if (h.length === 0) return [];
						return _.filter(_.map(h.split(/\//), function (it) {
							return it.trim();
						}), function (it) {
							return it.length > 0;
						});
					},
					urlToPath: function (url) {
						if (_.isString(url)) {
							var hashAt = url.lastIndexOf('#');
							if (hashAt >= 0 && hashAt < url.length - 1) {
								return _.filter(_.map(url.substring(hashAt + 1).split(/\//), function (it) {
									return it.trim();
								}), function (it) {
									return it.length > 0;
								});
							}
						}
						return [];
					}
				}
			})(),
			Locale: (function () {
				var collator = null;
				if ($route.user.locale) {
					try {
						if (_.isObject(Intl) && _.isObject(Intl.Collator)) {
							collator = new Intl.Collator($route.user.locale, {sensitivity: "base"});
						}
					} catch (ignored) {
					}
				}

				var normalize;
				if (_.isFunction(String.prototype.normalize)) {
					try {
						normalize = function (v) {
							return v ? v.toString().normalize('NFD').replace(/[\u0300-\u036f]/gi, "") : v;
						}
					} catch (ignored) {
					}
				}
				if (!normalize) {
					normalize = function (v) {
						return v ? v.toString() : v;
					};
				}

				return {
					compare: function (a, b, nullsLast) {
						if (!a && !b) return 0;
						if (!a || !b) {
							return !!nullsLast ? ((a ? 0 : 1) - (b ? 0 : 1)) : ((!a ? 0 : 1) - (!b ? 0 : 1));
						}
						var x;
						if (_.isString(a) || _.isString(b)) {
							return collator ? collator.compare(a || "", b || "") : a < b ? -1 : a > b ? 1 : 0;
						}
						else if (_.isNumber(a) || _.isNumber(b)) {
							x = (a || 0) - (b || 0);
							return x > 0 ? 1 : x < 0 ? -1 : 0;
						} else if (_.isDate(a) || _.isDate(b)) {
							a = a ? a : new Date();
                            b = b ? b : new Date();
							return a < b ? -1 : a > b ? 1 : 0;
						}
						console.log('niop');
						throw new Error("cannot compare(a,b): " + a + " , " + b);
					},
					normalize: normalize
				};
			})(),
			Dialog: {
				createDeferredDialogCache: function (fnGetDialogContext, dialogNames) {
					var dialogCache = {};
					var dialogNamePattern = /^(?:([a-zA-Z]+):)?([a-zA-Z]+)$/;

					if (!_.isFunction(fnGetDialogContext)) {
						throw new TypeError("fnGetDialogContext: function expected");
					}

					if (_.isEmpty(dialogNames) || !_.isArray(dialogNames)) {
						var msg = "invalid dialog definitions";
						console.error("%s: %O", msg, dialogNames);
						throw new Error(msg);
					}
					_.each(dialogNames = _.uniq(dialogNames), function verifyDialogName(dialogName) {
						if (!_.isString(dialogName)) {
							throw new TypeError("dialogName invalid: " + dialogName);
						}
						var nameMatch = dialogNamePattern.exec(dialogName);
						if (!nameMatch) {
							throw new Error("dialogName invalid: " + dialogName);
						}
						var key = nameMatch[2];
						if (dialogCache.hasOwnProperty(key)) {
							throw new Error("dialogName conflict: " + dialogName)
						}
						return dialogName;
					});

					_.each(dialogNames, function (dialogName) {
						var groupName = $route.mode;
						var nameMatch = dialogNamePattern.exec(dialogName);
						if (nameMatch[1]) {
							groupName = nameMatch[1];
							dialogName = nameMatch[2];
						}
						dialogCache[dialogName] = function () {
							return new Promise(function (resolve, reject) {
								requirejs(['app/dialog/' + groupName + '/' + dialogName], function (dialog) {
									var fnInit = dialog["init"];
									if (!_.isFunction(fnInit)) {
										reject(new TypeError("dialog::init: " + dialogName));
									}
									var fnInvoke = dialog["invoke"];
									if (!_.isFunction(fnInvoke)) {
										reject(new TypeError("dialog::invoke: " + dialogName));
									}
									var dialogContext = fnGetDialogContext();
									if (!_.isObject(dialogContext)) {
										throw new Error("dialogContext: object expected");
									}
									fnInit(dialogContext);
									resolve(fnInvoke);
								});
							});
						};
					});

					var dialogs = {};
					_.each(_.keys(dialogCache), function (dialogName) {
						Object.defineProperty(dialogs, dialogName, {
							value: function (dialogParams) {
								var delegate = dialogCache[dialogName];
								if (_.isFunction(delegate)) {
									console.log("defining dialog: %s", dialogName);
									delegate = delegate(); // define Promise lazily
									dialogCache[dialogName] = delegate;
								}
								return delegate.then(function (dialog) {
									return dialog(dialogParams);
								});
							},
							enumerable: true
						})
					});

					return Object.preventExtensions(dialogs);
				}
			},
			Badge: {
				invalidate: $badge.markStale,
				addUpdateListener: function (listener) {
					if (!_.isFunction(listener)) throw new TypeError("function expected: " + listener);
					var lix = $badge.updateListeners.indexOf(listener);
					if (lix === -1) $badge.updateListeners.push(listener);
				},
				removeUpdateListener: function (listener) {
					if (!_.isFunction(listener)) throw new TypeError("function expected: " + listener);
					var lix = $badge.updateListeners.indexOf(listener);
					if (lix !== -1) $badge.updateListeners.splice(lix, 1);
				}
			},
			Charts: {
				cache: [],
				/**
				 * Tracks a chart, for resource management (to free resources when chart is removed from DOM).
				 * @param {Chart} chart to track.
				 */
				track: function (chart) {
					$home.Charts.cache.push(chart);
				},
				/**
				 * Frees resources for all tracked charts.
				 * To be called when removing chart from DOM.
				 */
				clear: function () {
					var $cc = $home.Charts.cache;
					while ($cc.length > 0) {
						$cc.pop().destroy(); // to avoid chart memory leaks
					}
				}
			},
			View: {
				Pane: {
					get content() {
						return $('body > main').eq(0);
					},
					get sidebar() {
						return $('body > nav').eq(0);
					},
					get header() {
						return $('body > header').eq(0);
					},
					get footer() {
						return $('body > footer').eq(0);
					},
					get all() {
						var $vp = $home.View.Pane;
						return $vp.content
							.add($vp.sidebar)
							.add($vp.header)
							.add($vp.footer);
					}
				},
				Options: {
					get enableWelcomeReset() {
						return !!$route.options.enableWelcomeReset;
					}
				},
				set title(text) {
					if (!_.isString(text)) text = "";
					var $h1 = $home.View.Pane.header.find('h1').eq(0).text(text);
					RT.jQuery.withClassIf($h1, 'masked', !text.length);
				},
				set documentTitle(text) {
					if (_.isString(text) && (text = text.trim()).length) {
						document.title = RT.Text.appNamePrefix + text;
					}
					else {
						document.title = RT.Text.appName;
					}
				},
				set actions(list) {
					// todo: View.actions = ....
				},
				set warn(value) {
					var panes = $home.View.Pane.all.removeClass('inactive');
					if (value) {
						panes.addClass('warn');
					}
					else {
						panes.removeClass('warn');
					}
				},
				set inactive(value) {
					var panes = $home.View.Pane.all.removeClass('warn');
					if (value) {
						panes.addClass('inactive');
					}
					else {
						panes.removeClass('inactive');
					}
				},
				printCodeFault: function (err, msg) {
					var details = _.isNumber(err.statusCode)
						? RT.Diagnostics.toNetworkErrorMessage(err, msg)
						: RT.Diagnostics.toErrorMessage(err, msg);
					$('<code>').text(details).appendTo($home.View.Pane.content.empty());
				},
				rejectHandler: function (err) {
					$home.View.warn = true;
					$home.View.printCodeFault(err);
				},
				get thinWidth() {
					return 640;
				},
				get isWideDisplay() {
					return window.matchMedia && window.matchMedia('(min-width: ' + $home.View.thinWidth + 'px)').matches;
				}
			},
			File: {
				send: function (uri) {
					return new Promise(function (resolve, reject) {
						if (!_.isString(uri) || _.isEmpty(uri)) {
							console.error("send: invalid URI: %O", uri);
							reject(new Error("invalid URI"));
							return;
						}
						var done = function (evt) {
							var body = $(this).contents().find('body').text();
							if (body) {
								console.error("send: unexpected response:\n%s", body);
								var parsed = (/^HTTP ([1-5][0-9]{2}) (.+)$/m).exec(body);
								reject({
									statusCode: parsed ? parseInt(parsed[1], 10) : 0,
									textStatus: parsed ? parsed[2] : '',
									body: body
								});
							}
							else {
								console.log("sent: %s", evt.target.src);
								resolve(uri);
							}
							setTimeout(function () {
								$iframe.remove();
							}, 250); // timeout must match CSS transition duration
						};
						var $iframe = $('<iframe>').attr({
							'class': 'get',
							'src': uri
						}).on('load error', done).appendTo($(document.body).find('header').eq(0));
					});
				},
				toExtension: function (fileName) {
					return fileName.toLowerCase().split(".").pop();
				},
				isDocumentType: function (extension) {
					return _.includes($route.documents.types, extension);
				}
			},
			Image: {
				Exif: {
					/*orientation: $route.imaging.exifOrientation*/
				},
				Thumb: $route.imaging.thumb,
				isImageType: function (extension) {
					return _.includes($route.imaging.types, extension);
				},
				Vector: {
					/**
					 * Asynchronously fetches one or more SVG files.
					 * @param {object} o key-value pairs, where value is a string SVG filename with extension.
					 * @returns {Promise}
					 */
					fetchSVG: function (o) {
						var fields = [];
						var errors = [];
						if (_.isObject(o)) {
							for (var p in o) {
								if (o.hasOwnProperty(p)) {
									if (_.isString(o[p]) && o[p].length > 4 && o[p].substring(o[p].length - 4).toLowerCase() === ".svg") {
										fields.push(p);
									}
									else {
										errors.push(p);
									}
								}
							}
						}
						if (errors.length || !fields.length) {
							return new Promise(function (resolve, reject) {
								if (errors.length) {
									reject(new Error(errors.join()));
									return;
								}
								reject(new Error("no fields with .svg"))
							});
						}

						var serializer = new XMLSerializer();
						var deferred = [];
						_.each(fields, function (f) {
							var uri = o[f];
							deferred.push(RT.jQuery.get({
								url: $route.uri.themeStyleUri + "media/svg/" + uri,
								contentType: false,
								dataType: "xml"
							}).then(function (rs) {
								var x = {
									uri: uri,
									svg: rs.data.documentElement,
									toString: function () {
										return serializer.serializeToString(x.svg);
									}
								};
								o[f] = x;
								return new Promise(function (resolve) {
									resolve(x);
								});
							}));
						});
						return Promise.all(deferred);
					}
				}
			},
			/**
			 * Creates a new instance of a Lodash template cache.
			 * Templates are loaded (and cached) on-demand.
			 * @return {Object} a new instance, with a "template(name)" function for accessing the template as a Promise.
			 */
			createDeferredTemplateCache: function () {
				/**
				 * Defines a promise to fetch a Lodash template on-demand.
				 * @param templateName the unqualified name of the microtemplate (no path and no file extension).
				 * @returns {Promise} the promise, with the template function provided as the resolved value.
				 */
				function deferredTemplate(templateName) {
					if (typeof templateName !== 'string') {
						throw new TypeError('templateName');
					}
					return new Promise(function (resolve/*,reject*/) {
						requirejs(['text!mt/' + templateName + '.jst'], function (templateText) {
							var t1 = _.template(templateText, {variable: 'data'});
							var t2 = console.timeEnd ? function () {
								var tag = "template:" + templateName;
								var cns = RT.Diagnostics.Console;
								cns.group(tag);
								cns.time(tag);
								var result = t1.apply(t1, arguments);
								cns.timeEnd(tag);
								if (result) {
									console.log("%s: %s (UCS-2)", tag, RT.Format.formatBytes(result.length * 2)); // assume UCS-2 internally
								}
								else {
									console.warn("%s: result %s for %O", tag, result, arguments);
								}
								cns.groupEnd();
								return result;
							} : undefined;
							resolve(t2 ? t2 : t1);
						});
					});
				}

				return (function () {
					var cache = {};
					var api = {
						template: function (templateName) {
							var t = cache[templateName];
							if (!_.isUndefined(t)) {
								return t;
							}

							t = deferredTemplate(templateName);
							return (cache[templateName] = t);
						},
						/**
						 * Asynchronously fetches one or more JST Lodash template function files, replacing name values with resolved template functions.
						 * @param {object} o key-value pairs, where value is a string template filename without extension.
						 * @returns {Promise}
						 */
						fetchTemplates: function (o) {
							var fields = [];
							var errors = [];
							if (_.isObject(o)) {
								for (var p in o) {
									if (o.hasOwnProperty(p)) {
										if (_.isString(o[p]) && o[p].length > 4) {
											fields.push(p);
										}
										else {
											errors.push(p);
										}
									}
								}
							}
							if (errors.length || !fields.length) {
								return new Promise(function (resolve, reject) {
									if (errors.length) {
										reject(new Error(errors.join()));
										return;
									}
									reject(new Error("no template fields"))
								});
							}

							var deferred = [];
							_.each(fields, function (f) {
								var n = o[f];
								deferred.push(api.template(n)
									.then(function (fn) {
										o[f] = fn;
										return new Promise(function (resolve) {
											resolve(fn);
										});
									})
								);
							});
							return Promise.all(deferred);
						}
					};
					return api;
				}());
			},
			/**
			 * Creates a new instance of an on-demand RequireJS script cache.
			 */
			createDeferredModuleCache: function () {
				function deferredModule(moduleName) {
					if (typeof moduleName !== 'string') {
						throw new TypeError('moduleName');
					}
					return new Promise(function (resolve/*,reject*/) {
						requirejs([moduleName], function (impl) {
							resolve(impl);
						});
					});
				}

				return (function () {
					var cache = {};
					return {
						/**
						 * Asynchronously gets the specified RequireJS module.
						 * @param moduleName the name (path) of the module.
						 * @returns {Promise} a promise resolving to the specified module.
						 */
						module: function (moduleName) {
							var m = cache[moduleName];
							if (m) return m;

							m = deferredModule(moduleName);
							return (cache[moduleName] = m);
						}
					}
				}());
			},
			jQuery: {
				keyToClick: function (evt) {
					if (evt.keyCode === 13 || evt.keyCode === 32) $(this).click();
				},
				/**
				 * Creates a TypeAhead data source.
				 * @param {jQuery} input jQuery text input selector to use as a typeahead.
				 * @param {object} params data source configuration.
				 * @param {string} params.name data source name.
				 * @param {string} params.identityKey name of the field (in the array of returned objects) used as the identity value (tracked using the identity data attribute).
				 * @param {string} params.displayKey name of the field (in the array of returned objects) used as the displayed value.
				 * @param {function} params.source provides the array of objects to run the typeahead query against.
				 * @param {function} [params.onChange] callback invoked with value (selected or typed) when the typeahead loses focus.
				 * @param {function} [params.onSelect] callback invoked with object selected from matching query results.
				 * @param {function} [params.onOpen] callback invoked when opening menu.
				 * @param {number} [params.minLength] minimum input length required to trigger suggestions, defaulting to 1.
				 * @param {number} [params.limit] maximum number of suggestions to display, defaulting to 5.
				 * @param {boolean} [params.normalize] when focus leaves the input, verify that the current value matches the last selected value, or force it to another value if unambiguous, defaulting to false.
				 * @return {object} handle, providing read-only access to the "selector", the currently-selected "identity" (if any), the current input "text", and write-only "value" access (can be set to an object from the source).
				 */
				createTypeAhead: function (input, params) {
					if (!RT.jQuery.is(input) || input.length !== 1) {
						throw new Error('single element jQuery "input" selector required: ' + input);
					}
					_.each(['name', 'identityKey', 'displayKey'], function (k) {
						var v = params[k];
						if (!_.isString(v) || v.length === 0) throw new Error('string required: ' + k);
					});
					_.each(['source'], function (k) {
						var f = params[k];
						if (!_.isFunction(f)) throw new Error('function required: ' + k);
					});

					var ds = {
						name: params.name,
						displayKey: params.displayKey,
						async: false,
						source: function (query, syncResults/*, asyncResults*/) {
							var normalize;
							if (_.isFunction(String.prototype.normalize)) {
								try {
									normalize = function (v) {
										return v ? v.toString().normalize('NFD').replace(/[\u0300-\u036f]/gi, "").toLowerCase() : v;
									}
								} catch (ignored) {
								}
							}
							if (!normalize) {
								normalize = function (v) {
									return v ? v.toString().toLowerCase() : v;
								};
							}
							var q = normalize(query);
							var source = params.source();
							var length = source.length;
							var results = [];
							for (var i = 0; i < length; i++) {
								var it = source[i];
								var v = it[params.displayKey];
								v = _.isFunction(v) ? normalize(v()) : normalize(v);
								if (v && v.indexOf(q) >= 0) results.push(it);
							}
							syncResults(results);
						}
					};
					if (_.isInteger(params.limit) && params.limit > 0) {
						ds.limit = params.limit;
					}
					input.typeahead({
						minLength: _.isInteger(params.minLength) ? params.minLength : 1
					}, ds);
					var trackSelection = function (selectedResult) {
						if (_.isObject(selectedResult)) {
							var sk = selectedResult[params.identityKey];
							var st = selectedResult[params.displayKey];
							if (_.isFunction(st)) st = st();
							input.data('selectedId', sk);
							input.data('selectedText', st);
						}
						else {
							input.removeData('selectedId');
							input.removeData('selectedText');
						}
					};
					var updateTooltip = function () {
						var tt = input.closest('span.twitter-typeahead');
						if (tt) {
							var text = input.data('selectedText');
							if (!_.isEmpty(text)) {
								tt.attr('title', text);
							}
							else {
								tt.removeAttr('title');
							}
						}
					};
					input.on('typeahead:change typeahead:idle', function (jqEvent, value) {
						if ('typeahead:idle' === jqEvent.type && !value) {
							if (value = jqEvent.target.value || "") return;
						}
						if (_.isFunction(value)) value = value();
						if (params.normalize) {
							var trackedValue = input.data('selectedText');
							if (trackedValue && !_.isString(trackedValue)) trackedValue = trackedValue.toString();
							if (trackedValue !== value) {
								var selectionNormalized = function (selection) {
									trackSelection(selection);
									if (_.isFunction(params.onSelect)) {
										params.onSelect(selection, ds.name);
									}
								};
								if (value.length > 0) {
									ds.source(value, function (results) {
										if (_.isArray(results) && results.length === 1) {
											var normalized = results[0][params.displayKey];
											if (_.isFunction(normalized)) normalized = normalized();
											console.log('typeahead: normalized "%s": %s', value, normalized);
											selectionNormalized(results[0]);
											input.typeahead('val', value = normalized);
										}
										else {
											console.log('typeahead: unresolved "%s"', value);
											selectionNormalized(null);
											input.typeahead('val', '');
										}
									});
								}
								else {
									selectionNormalized(null);
								}
							}
							updateTooltip();
						}
						if (_.isFunction(params.onChange)) {
							params.onChange(value);
						}
					});
					input.on('typeahead:select typeahead:autocomplete', function (jqEvent, selectedResult, datasetName) {
						trackSelection(selectedResult);
						updateTooltip();
						if (_.isFunction(params.onSelect)) {
							params.onSelect(selectedResult, datasetName);
						}
					});
					input.on('typeahead:open', function (jqEvent, selectedResult, datasetName) {
						trackSelection(selectedResult);
						updateTooltip();
						if (_.isFunction(params.onOpen)) {
							params.onOpen(selectedResult, datasetName);
						}
					});
					return {
						get isTypeAhead() {
							return true;
						},
						get selector() {
							return input;
						},
						get identity() {
							return input.data('selectedId');
						},
						get text() {
							return input.typeahead('val');
						},
						set value(v) {
							if (_.isObject(v) && v[params.displayKey]) {
								trackSelection(v);
								var st = v[params.displayKey];
								if (_.isFunction(st)) st = st();
								input.typeahead('val', st);
							}
							else {
								trackSelection(null);
								input.typeahead('val', '#!'); // hack: force typeahead 1.1.1 to reset drop-down (doesn't do it for empty queries)
								input.typeahead('val', '');
								updateTooltip();
							}
						}
					};
				},

				createTypeAheadWithAccent: function (input, params) {
					if (!RT.jQuery.is(input) || input.length !== 1) {
						throw new Error('single element jQuery "input" selector required: ' + input);
					}
					_.each(['name', 'identityKey', 'displayKey','accentKey'], function (k) {
						let v = params[k];
						if (!_.isString(v) || v.length === 0) throw new Error('string required: ' + k);
					});
					_.each(['source'], function (k) {
						let f = params[k];
						if (!_.isFunction(f)) throw new Error('function required: ' + k);
					});

					let sourceForEmphasis = params.source();
					let i;
					let accentedList = [];
					for (i = 0; i < sourceForEmphasis.length; i++) {
						if(sourceForEmphasis[i][params.accentKey]){
							accentedList.push(sourceForEmphasis[i][params.displayKey]);
						}
					}
					Handlebars.registerHelper("templateStrongTypeahead", function(name,options) {
						let isAccented = false;
						_.each(accentedList, function(it) {
							if(name.includes(it)){
								isAccented = true;
							}
						})
						if(isAccented){
							return name;
						}else{
							return '';
						}
					});

					Handlebars.registerHelper("templateNormalTypeahead", function(name,options) {
						let isAccented = false;
						_.each(accentedList, function(it) {
							if(name.includes(it)){
								isAccented = true;
							}
						})
						if(isAccented){
							return '';
						}else{
							return name;
						}
					});
					let ds = {
						name: params.name,
						displayKey: params.displayKey,
						accentKey: params.accentKey,
						async: false,
						source: function (query, syncResults/*, asyncResults*/) {
							let normalize;
							if (_.isFunction(String.prototype.normalize)) {
								try {
									normalize = function (v) {
										return v ? v.toString().normalize('NFD').replace(/[\u0300-\u036f]/gi, "").toLowerCase() : v;
									}
								} catch (ignored) {
								}
							}
							if (!normalize) {
								normalize = function (v) {
									return v ? v.toString().toLowerCase() : v;
								};
							}
							let q = normalize(query);
							let source = params.source();
							let length = source.length;
							let results = [];
							for (let i = 0; i < length; i++) {
								let it = source[i];
								let v = it[params.displayKey];
								v = _.isFunction(v) ? normalize(v()) : normalize(v);
								if (v && v.indexOf(q) >= 0) results.push(it);
							}
							syncResults(results);
						},
						templates: {
							suggestion: Handlebars.compile('<div><strong>{{templateStrongTypeahead name}}</strong>{{templateNormalTypeahead name}}</div>')
						}
					};
					if (_.isInteger(params.limit) && params.limit > 0) {
						ds.limit = params.limit;
					}
					input.typeahead({
						minLength: _.isInteger(params.minLength) ? params.minLength : 1
					}, ds);
					let trackSelection = function (selectedResult) {
						if (_.isObject(selectedResult)) {
							let sk = selectedResult[params.identityKey];
							let st = selectedResult[params.displayKey];
							if (_.isFunction(st)) st = st();
							input.data('selectedId', sk);
							input.data('selectedText', st);
						}
						else {
							input.removeData('selectedId');
							input.removeData('selectedText');
						}
					};
					let updateTooltip = function () {
						let tt = input.closest('span.twitter-typeahead');
						if (tt) {
							let text = input.data('selectedText');
							if (!_.isEmpty(text)) {
								tt.attr('title', text);
							}
							else {
								tt.removeAttr('title');
							}
						}
					};
					input.on('typeahead:change typeahead:idle', function (jqEvent, value) {
						if ('typeahead:idle' === jqEvent.type && !value) {
							if (value = jqEvent.target.value || "") return;
						}
						if (_.isFunction(value)) value = value();
						if (params.normalize) {
							let trackedValue = input.data('selectedText');
							if (trackedValue && !_.isString(trackedValue)) trackedValue = trackedValue.toString();
							if (trackedValue !== value) {
								let selectionNormalized = function (selection) {
									trackSelection(selection);
									if (_.isFunction(params.onSelect)) {
										params.onSelect(selection, ds.name);
									}
								};
								if (value.length > 0) {
									ds.source(value, function (results) {
										if (_.isArray(results) && results.length === 1) {
											let normalized = results[0][params.displayKey];
											if (_.isFunction(normalized)) normalized = normalized();
											console.log('typeahead: normalized "%s": %s', value, normalized);
											selectionNormalized(results[0]);
											input.typeahead('val', value = normalized);
										}
										else {
											console.log('typeahead: unresolved "%s"', value);
											selectionNormalized(null);
											input.typeahead('val', '');
										}
									});
								}
								else {
									selectionNormalized(null);
								}
							}
							updateTooltip();
						}
						if (_.isFunction(params.onChange)) {
							params.onChange(value);
						}
					});
					input.on('typeahead:select typeahead:autocomplete', function (jqEvent, selectedResult, datasetName) {
						trackSelection(selectedResult);
						updateTooltip();
						if (_.isFunction(params.onSelect)) {
							params.onSelect(selectedResult, datasetName);
						}
					});
					input.on('typeahead:open', function (jqEvent, selectedResult, datasetName) {
						//debugger;
						trackSelection(selectedResult);
						updateTooltip();
						if (_.isFunction(params.onOpen)) {
							params.onOpen(selectedResult, datasetName);
						}
					});
					return {
						get isTypeAhead() {
							return true;
						},
						get selector() {
							return input;
						},
						get identity() {
							return input.data('selectedId');
						},
						get text() {
							return input.typeahead('val');
						},
						set value(v) {
							if (_.isObject(v) && v[params.displayKey]) {
								trackSelection(v);
								var st = v[params.displayKey];
								if (_.isFunction(st)) st = st();
								input.typeahead('val', st);
							}
							else {
								trackSelection(null);
								input.typeahead('val', '#!'); // hack: force typeahead 1.1.1 to reset drop-down (doesn't do it for empty queries)
								input.typeahead('val', '');
								updateTooltip();
							}
						}
					};
				},
				setTypeAheadValue: function ($jq, v) {
					if ($jq.isTypeAhead) {
						$jq.value = v;
					}
					else if ($jq.is(':hidden')) {
						$jq.val(v && v.id ? v.id : '');
					}
					else if ($jq.is(':text')) {
						$jq.val(v && v.name ? v.name : '');
					}
					else {
						throw new Error("cannot set value");
					}
				}
			}
		};

		Object.defineProperty($home.User, "expat", {
			get() {
				return $home.User.profile === "XP";
			}
		});
		Object.defineProperty($home.User, "staff", {
			get() {
				return ["SF", "CT", "HR"].indexOf($home.User.profile) >= 0;
			}
		});

		// initialize on load
		$(function () {
			// activate CSS styles requiring JS interaction
			$('html').eq(0).addClass('js-enabled');

			$home.View.Pane.sidebar.find('.l7n-ctl > .user-locale > a')
				.on('click', function (evt) {
					let $a = $(this);
					let uri = $a.attr('href');
					RT.jQuery.put({
						url: uri,
						contentType: false,
						dataType: false
					}).then(function (rs) {
						console.log("set-locale: %s (%s)", uri.split("/").pop(), rs.statusCode);
						return new Promise(function (resolve) {
							setTimeout(function () {
								location.reload();
								resolve("reload");
							}, 100);
						});
					}).catch(function (fault) {
						console.error("set-locale: invocation fault on %s", uri, fault);
					});
					return RT.jQuery.cancelEvent(evt);
				});

			$badge.updateAsync();
		});

		return $home;
	}
);