define(
	['text!l20n/text.json', 'jquery', 'lodash', 'sprintf', 'moment'],
	function (l20n, $, _, sprintf, moment) {
		"use strict";

		var $RT = {
			Diagnostics: {
				toErrorMessage: function (e, msg) {
					if (_.isString(e)) return e;

					if (e instanceof Error) console.error("Fault diagnostics: %O", e);

					msg = _.isString(msg) ? msg + "\n\n" : "";
					msg += e.name + ": " + e.message;
					if ("undefined" !== typeof e.stack) {
						msg += "\n\n" + e.stack;
					}
					else if ("undefined" !== typeof e.fileName) {
						msg += "\n\n" + e.fileName + ":" + e.lineNumber + " (" + e.columnNumber + ")";
					}
					return msg;
				},
				toNetworkErrorMessage: function (e, msg) {
					// e: jQuery ajax error
					msg = _.isString(msg) ? msg : "";
					var sc = e.statusCode;
					if (_.isInteger(sc)) {
						if (msg.length > 0) msg += "\n\n";
						switch (sc) {
							case 403:
							case 401:
								msg += $RT.Text.ajaxSessionError;
								break;
							case 0:
								msg += $RT.Text.ajaxNetworkError;
								break;
							default:
								if (sc >= 500) {
									msg += $RT.Text.ajaxServerError;
								}
								else if (sc >= 400) {
									msg += $RT.Text.ajaxClientError;
								}
								if (msg.length > 0) msg += "\n\n";
								msg += "HTTP " + sc;
								if (_.isString(e.url)) {
									msg += ": " + e.url;
								}
								if (_.isString(e.errorThrown)) {
									msg += "\n" + e.errorThrown;
								}
								else if (e.errorThrown instanceof Error) {
									msg += "\n" + e.errorThrown.name;
									if (_.isString(e.errorThrown.message)) {
										msg += ": " + e.errorThrown.message;
									}
								}
						}
					}
					return msg;
				},
				showErrorAlert: function (e, msg) {
					// err: JS error object
					alert($RT.Diagnostics.toErrorMessage(e, msg));
				},
				showNetworkErrorAlert: function (e, msg) {
					// e: jQuery ajax error
					alert($RT.Diagnostics.toNetworkErrorMessage(e, msg));
				},
				isNetworkError: function (e) {
					return _.isInteger(e.statusCode);
				},
				Console: {
					group: console.groupCollapsed ? console.groupCollapsed.bind(console) : console.group ? console.group.bind(console) : _.noop,
					groupEnd: console.groupEnd ? console.groupEnd.bind(console) : _.noop,
					time: console.time ? console.time.bind(console) : _.noop,
					timeEnd: console.timeEnd ? console.timeEnd.bind(console) : _.noop
				}
			},
			Text: JSON.parse(l20n),
			Time: {
				createMomentCache: function () {
					var momentCache = {};
					return function (dt) {
						var m = momentCache[dt];
						if (!m) {
							m = moment(dt);
							if (!m.isValid()) {
								throw new Error("invalid: " + dt);
							}
							momentCache[dt] = m;
						}
						return m;
					};
				}
			},
			Format: {
				sprintf: sprintf.sprintf,
				vsprintf: sprintf.vsprintf,
				nl2br: function (str) {
					return str.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br />$2');
				},
				formatBytes: function (bytes, localize) {
					if (bytes < 1024) {
						return bytes + " Bi";
					}
					var v, u;
					if (bytes < 1048576) {
						v = (bytes / 1024).toFixed(3);
						u = " KiB";
					}
					else if (bytes < 1073741824) {
						v = (bytes / 1048576).toFixed(3);
						u = " MiB";
					}
					else {
						v = (bytes / 1073741824).toFixed(3);
						u = " GiB";
					}
					return (localize ? $RT.Format.formatDecimal(v, 3) : v) + u;
				},
				formatDecimal: function (x, scale, separator) {
					var s;
					if (_.isString(x)) {
						s = x;
					}
					else {
						if (!_.isNumber(scale)) scale = 2;
						s = sprintf.sprintf("%." + scale + "f", x);
					}
					if (!_.isString(separator)) separator = $RT.Text.decimalSeparator;
					if (separator !== ".") s = s.replace(/\./, separator);
					return s;
				},
				padInt: function (n, w) {
					var s1 = "" + n;
					var s2 = "000000000000000".slice(w * -1);
					return s1.length >= w ? s1 : (s2 + s1).slice(w * -1);
				},
				pad2: function (n) {
					return $RT.Format.padInt(n, 2);
				},
				Capitalize: (function () {
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
						all: function (text, trim) {
							if (!_.isString(text) || !text.length) return text;
							text = normalize(text).toUpperCase();
							return !!trim ? text.trim() : text;
						},
						start: function (text, trim) {
							if (!_.isString(text) || !text.length) return text;
							for (var i = 0; i < text.length; i++) {
								var c = text.charAt(i);
								if (/[\S]/.test(c)) {
									text = text.substring(0, i) + normalize(c).toUpperCase() + text.substring(i + 1);
									break;
								}
							}
							return !!trim ? text.trim() : text;
						}
					}
				})(),
				Mail: {
					match: function (m) {
						var re = /^[\w!#$%&'*+/=?`{|}~^-]+(?:\.[\w!#$%&'*+/=?`{|}~^-]+)*@(?:[A-Z0-9-]+\.)+[A-Z]{2,6}$/i;
						return m && _.isString(m) && re.test(m);
					}
				},
				Date: {
					toDateFields: function (date) {
						if (_.isDate(date)) {
							return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
						}
						if (_.isString(date)) {
							return $RT.Format.ISO8601.parseDateFields(date);
						}
						if (_.isArray(date) && date.length === 3) return date;
						throw new Error("cannot convert to date fields: " + date);
					},
					toDateObject: function (date, withoutTimezoneOffset) {
						date = $RT.Format.Date.toDateFields(date);
						date = new Date(date[0], date[1] - 1, date[2], 0, 0, 0, 0);
						if (withoutTimezoneOffset) {
							date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
						}
						return date;
					},
					digits: function (date) {
						date = $RT.Format.Date.toDateFields(date);
						return sprintf.sprintf($RT.Text.calendarDigitDate, date[2], date[1], date[0]);
					}
				},
				Month: {
					inRange: function (month) {
						if (_.isNumber(month) && _.inRange(month, 1, 13)) return month;
						throw new Error("month: required 1-12, got: " + month);
					},
					/**
					 * @param {Number} month 1-12.
					 * @return full localized name.
					 */
					full: function (month) {
						return $RT.Text["mf" + $RT.Format.Month.inRange(month)];
					},
					/**
					 * @param {Number} month 1-12.
					 * @return short localized name.
					 */
					short: function (month) {
						return $RT.Text["ms" + $RT.Format.Month.inRange(month)];
					}
				},
				YearMonth: {
					re: /^([0-9]{4})-(0[1-9]|1[0-2])$/,
					/**
					 * @param {Date} [d] date to format.
					 * @return {string} an ISO8601-formatted Year-Month.
					 */
					format: function (d) {
						if (!_.isDate(d)) d = new Date();
						return sprintf.sprintf("%d-%02d", d.getFullYear(), d.getMonth() + 1);
					},
					/**
					 * @param {Date|Array|String} [d] date to format.
					 * @return {string} a localized Year-Month string.
					 */
					full: function (d) {
						if (_.isString(d)) {
							d = $RT.Format.YearMonth.parse(d);
						}
						else if (!_.isArray(d) || d.length < 2 || d.length > 3) {
							d = $RT.Format.Date.toDateFields(d);
						}
						return sprintf.sprintf($RT.Text.calendarMonthOfYear, d[0], $RT.Format.Month.full(d[1]));
					},
					/**
					 * @param {Date|Array|String} [d] date to format.
					 * @return {string} a localized Year-Month string.
					 */
					short: function (d) {
						if (_.isString(d)) {
							d = $RT.Format.YearMonth.parse(d);
						}
						else if (!_.isArray(d) || d.length < 2 || d.length > 3) {
							d = $RT.Format.Date.toDateFields(d);
						}
						return sprintf.sprintf($RT.Text.calendarMonthOfYear, d[0], $RT.Format.Month.short(d[1]));
					},
					/**
					 * @param {string} s Year-Month string.
					 * @return {boolean} true if ISO8601-formatted, otherwise false.
					 */
					match: function (s) {
						return $RT.Format.YearMonth.re.test(s);
					},
					/**
					 * @param {string} s Year-Month string.
					 * @returns {null|Number[]} a 2-element array (if matched), containing year, then month, otherwise null.
					 */
					parse: function (s) {
						var m = $RT.Format.YearMonth.re.exec(s);
						return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
					}
				},
				YearWeek: {
					re: /^([0-9]{4})-W([0-4][0-9]|5[0-3])$/,
					/**
					 * @param {Number[]} w two-element integer array, first element is year and second is week of year.
					 * @returns {string} the formatted 2017-W01 string.
					 */
					format: function (w) {
						return sprintf.vsprintf("%1$04d-W%2$02d", w);
					},
					/**
					 * @param {string} s Year-Week string.
					 * @return {boolean} true if ISO8601-formatted, otherwise false.
					 */
					match: function (s) {
						return $RT.Format.YearWeek.re.test(s);
					},
					/**
					 * @param {string} s Year-Week string.
					 * @returns {null|Number[]} a 2-element array (if matched), containing year, then week, otherwise null.
					 */
					parse: function (s) {
						var m = $RT.Format.YearWeek.re.exec(s);
						return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
					}
				},
				ISO8601: {
					re: {
						dateStartOfMonth: /^([0-9]{4})-(0[1-9]|1[0-2])-01$/,
						date: /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/,
						dateTime: /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T([01][1-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/
					},
					parseDateFields: function (s) {
						var m = $RT.Format.ISO8601.re.date.exec(s);
						return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
					},
					parseDateTimeFields: function (s) {
						var m = $RT.Format.ISO8601.re.dateTime.exec(s);
						return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6])] : null;
					},
					format: function (date) {
						if (date && moment.isMoment(date)) {
							return date.format('YYYY-MM-DD');
						}
						date = $RT.Format.Date.toDateFields(date);
						return sprintf.sprintf("%04d-%02d-%02d", date[0], date[1], date[2]);
					}
				}
			},
			Convert: {
				toDate: function (collection, fieldName) {
					if (!_.isString(fieldName)) {	// TODO: support arrays of strings
						throw new TypeError("Parameter \"fieldName\" must be a string, was " + typeof fieldName);
					}

					// convert msec times to Date objects
					_.each(collection, function (it) {
						var v = it[fieldName];
						if (_.isNumber(v)) {
							it[fieldName] = new Date(v);
						}
					});

				}
			},
			jQuery: {
				is: function (o) {
					return o instanceof jQuery;
				},
				ajax: function (ajaxConfig, method) {
					var acceptErrorStatusCodes = [];
					if (_.isArray(ajaxConfig.acceptErrorStatusCodes)) {
						acceptErrorStatusCodes = ajaxConfig.acceptErrorStatusCodes;
						delete ajaxConfig.acceptErrorStatusCodes;

						for (var i = 0; i < acceptErrorStatusCodes.length; i++) {
							var sc = acceptErrorStatusCodes[i];
							if (!_.isInteger(sc) || sc <= 0 || sc >= 600 || (sc >= 200 && sc < 300) || sc === 304) {
								throw new Error("out-of-range: acceptErrorStatusCodes[" + i + "]: " + sc);
							}
						}
					}
					if (!_.isObject(ajaxConfig)) {
						throw new TypeError("ajaxConfig object expected");
					}
					if (_.isUndefined(ajaxConfig.async)) {
						ajaxConfig.async = true;
					}
					if (_.isString(method)) {
						ajaxConfig.method = method;
					}

					return new Promise(function (resolve, reject) {
						$.ajax(ajaxConfig)
							.done(function (data, textStatus, jqXHR) {
								resolve({
									url: ajaxConfig.url,
									jqXHR: jqXHR,
									statusCode: jqXHR.status,
									data: data,
									textStatus: textStatus
								});
							})
							.fail(function (jqXHR, textStatus, errorThrown) {
								var result = {
									url: ajaxConfig.url,
									jqXHR: jqXHR,
									statusCode: jqXHR.status,
									textStatus: textStatus,
									errorThrown: errorThrown
								};
								if (acceptErrorStatusCodes.indexOf(result.statusCode) >= 0) {
									resolve(result);
								}
								else {
									reject(result);
								}
							});
					});
				},
				head: function (ajaxConfig) {
					return $RT.jQuery.ajax(ajaxConfig, "head");
				},
				get: function (ajaxConfig) {
					return $RT.jQuery.ajax(ajaxConfig, "get");
				},
				post: function (ajaxConfig) {
					return $RT.jQuery.ajax(ajaxConfig, "post");
				},
				put: function (ajaxConfig) {
					return $RT.jQuery.ajax(ajaxConfig, "put");
				},
				delete: function (ajaxConfig) {
					return $RT.jQuery.ajax(ajaxConfig, "delete");
				},
				/**
				 * Gets (or sets) a normalized date value from an (optional) input element, handling either ISO8601 or West-European date formats.
				 * @param [$jq] target input; value will be set using ISO8601-format if browser handles date inputs.
				 * @param [v] a string, array, or Date object.
				 * @returns {string} the value read, or set.
				 */
				dateValue: function ($jq, v) {
					if (!_.isUndefined(v)) {
						if ("" === v || null === v) {
							v = "";
						}
						if (!("" === v || null === v)) {
							v = /*$RT.Form.date ? $RT.Format.ISO8601.format(v) : */ $RT.Format.Date.digits(v);
						}
						if ($RT.jQuery.is($jq)) $jq.val(v);
						return v;
					}

					if (!$RT.jQuery.is($jq)) throw new Error("no element");

					v = $jq.val();

					var dayOfMonth = 0;

					// 1) Chrome "date" input format; 2) raw West-European text input format
					var dt_pattern_1 = /^(?:\s*)(\d{4})-(\d{2})-(\d{2})(?:\s*)$/;
					var dt_pattern_2 = /^(?:\s*)(\d{1,2})\/(\d{1,2})(?:\/(\d{2}(?:\d{2})?))?(?:\s*)$/;
					var match = dt_pattern_1.exec(v);
					if (match) {
						v = match[1] + '-' + match[2] + '-' + match[3];
						dayOfMonth = parseInt(match[3], 10);
					}
					else if (match = dt_pattern_2.exec(v)) {
						var fy = new Date().getFullYear();
						var y4 = fy.toString();
						v = match[3];
						if (_.isUndefined(v)) {
							v = y4;
						}
						else if (v.length === 2) {
							var y2 = _.toInteger(v);
							v = y4.substring(0, 2) + v;
							if (y2 > (fy % 100) + 10) {
								v = (_.toInteger(v) - 100).toString();
							}
						}
						v += '-' + $RT.Format.pad2(match[2]) + '-' + $RT.Format.pad2(match[1]);
						dayOfMonth = parseInt(match[1], 10);
					}
					else {
						v = '';
					}
					if (v.length > 0) {
						if ($RT.Format.ISO8601.re.date.test(v)) {
							if (dayOfMonth > 28) {
								var o = $RT.Format.Date.toDateObject(v);
								if (o.getDate() !== dayOfMonth) {
									v = sprintf.sprintf("%04d-%02d-%02d", o.getFullYear(), o.getMonth() + 1, o.getDate());
								}
							}
						}
						else {
							v = '';
						}
					}
					return v;
				},
				urlValue: function ($jq, v) {
					if (!$RT.jQuery.is($jq)) throw new Error("no element");

					if (_.isString(v) && v.length) {
						var vu = "";
						try {
							vu = new URL(vu);
						} catch (ignored) {
						}
						$jq.val(vu.toString());
						return;
					}

					try {
						v = new URL($jq.val().trim());
					} catch (ignored) {
					}
					return v || null;
				},
				intValue: function ($jq, v) {
					if (!$RT.jQuery.is($jq)) throw new Error("no element");

					if (_.isInteger(v)) {
						$jq.val(v.toString());
						return;
					}

					v = parseInt($jq.val(), 10);
					return isNaN(v) ? null : v;
				},
				decimalValue: function ($jq) {
					if (!$RT.jQuery.is($jq)) throw new Error("no element");

					var dv = $jq.length > 0 ? $jq.val() : null;
					if (!dv) return null;
					if (dv.length > 0) {
						var ds = $RT.Text.decimalSeparator;
						if (ds !== ".") {
							dv = dv.replace(new RegExp(ds, "g"), ".");
						}
					}
					dv = parseFloat(dv.replace(/\s/g, ''));
					return isNaN(dv) ? null : dv;
				},
				cancelBubble: function (evt) {
					evt.stopPropagation();
					return false;
				},
				cancelEvent: function (evt) {
					evt.stopPropagation();
					evt.preventDefault();
					return false;
				},
				withClassIf: function ($jq, className, predicate) {
					return $jq[predicate ? 'addClass' : 'removeClass'](className);
				},
				setupHoverClass: function ($jq, pushClass) {
					if (!_.isString(pushClass)) pushClass = "accent-color";
					return $jq.hover(
						function () {
							$(this).addClass(pushClass);
						},
						function () {
							$(this).removeClass(pushClass);
						}
					);
				},
				selectOnFocus: function ($jq) {
					if ($RT.jQuery.is($jq) && $jq.length > 0) {
						$jq.on('focus', function () {
							$(this).select();
						});
					}
					return $jq;
				},
				trimOnBlur: function ($jq) {
					if ($RT.jQuery.is($jq) && $jq.length > 0) {
						$jq.on('blur', function () {
							var $i = $(this);
							var v1 = $i.val();
							if (_.isString(v1) && v1.length) {
								var v2 = v1.trim();
								if (v2 !== v1) {
									$i.val(v2);
								}
							}
						});
					}
					return $jq;
				},
				forceIntFormat: function (evt, selector, unsigned) {
					var $el = $RT.jQuery.is(selector) ? selector : $(this);
					if (!$el.length) return;
					var vs = $el[0].validity;
					if (_.isObject(vs) && (vs.badInput)) {
						$el.val("");
						return;
					}
					if (_.isUndefined(unsigned)) {
						unsigned = !!$el.data("unsigned");
					}
					var v1 = $el.val();
					var v2 = v1.replace(/\D/g, "");
					if (v2.length && v2[0] === "0") {
						v2 = v2.replace(/^0+/, "");
						if (!v2) v2 = "0";
					}
					if (v1 !== v2) {
						v2 = parseInt(v2, 10);
						if (isNaN(v2) || (unsigned === true && v1.indexOf('-') === 0)) {
							v2 = "0";
						}
						else if (v1.indexOf('-') === 0) {
							v2 = '-' + v2.toString();
						}
						else {
							v2 = v2.toString();
						}
						$el.val(v2);
					}
				},
				forceDecimalFormat: function (evt, selector, unsigned, scale) {
					var $el = $RT.jQuery.is(selector) ? selector : $(this);
					if (!$el.length) return;

					unsigned = _.isUndefined(unsigned) ? !!$el.data("unsigned") : !!unsigned;
					scale = _.isUndefined(scale) ? _.toInteger($el.data("scale")) : 2;

					var v1 = $el.val();
					var dv = v1 ? $RT.jQuery.decimalValue($el) : null;
					if (_.isNumber(dv) && unsigned && dv < 0) dv = Math.abs(dv);
					var v2 = _.isNumber(dv) ? $RT.Format.formatDecimal(dv, scale) : null;

					if (v1 !== v2) {
						$el.val(v2 || "");
					}
				},
				forceDateFormat: function () {
					var $el = $(this);
					var v = $RT.jQuery.dateValue($el);
					if (!_.isEmpty(v)) {
						v = $RT.Format.Date.digits(v);
					}
					$el.val(v);
				},
				restyleInputs: function (selector) {
					if (!$RT.jQuery.is(selector)) {
						throw new TypeError("jQuery selector required, instead of: " + selector);
					}

					var pushUpInputState = function () {
						var $input = $(this);
						//var $label = $input.closest('label[class|=for-' + $input.attr('type') + ']');
						var $label = $input.closest('label[class|=for]');
						//var $label = $input.closest('label.for-' + $input.attr('type'));
						if ($input.is(':checked')) {
							$label.addClass('checked');
						}
						else {
							$label.removeClass('checked');
						}
						if ($input.is(':focus')) {
							$label.addClass('focus');
						}
						else {
							$label.removeClass('focus');
						}
					};

					var markRestyled = function () {
						$(this).addClass('restyled');
					};

					var $radios = selector.find('label[class|=for] input[type=radio][name][value]').each(pushUpInputState);

					$radios.filter(':not(.restyled)').on('change focus blur', function () {
						var $input = $(this);
						var $group = $radios.filter('[name="' + $input.attr('name') + '"]');
						$group.each(pushUpInputState);
					}).each(markRestyled); // mark as "restyled" to avoid re-binding handler if adding inputs at runtime

					var $toggles = selector.find('label.for-checkbox input[type=checkbox]').each(pushUpInputState);

					$toggles.on('change focus blur', pushUpInputState).each(markRestyled);

					return {
						get radios() {
							return $radios;
						},
						get checkboxes() {
							return $toggles;
						},
						get controls() {
							return $radios.add($toggles);
						},
						repaint: function () {
							$radios.each(pushUpInputState);
							$toggles.each(pushUpInputState);
						}
					};
				}
			},
			Canvas: {
				fitToContainer: function (canvas) {
					if (_.isString(canvas)) {
						var selector = canvas;
						canvas = document.querySelector(selector);
						if (!_.isElement(canvas) || "CANVAS" !== canvas.tagName) {
							throw new Error("not found: " + selector);
						}
					}
					if (!_.isElement(canvas)) {
						throw new TypeError("not an element: " + canvas);
					}
					if ("CANVAS" !== canvas.tagName) {
						throw new Error("not a canvas: " + canvas.tagName);
					}

					canvas.style.width = '100%';
					canvas.style.height = '100%';
					canvas.width = canvas.offsetWidth;
					canvas.height = canvas.offsetHeight;

					return canvas;
				}
			},
			Dnd: {
				/**
				 * Sets up drag and drop event handlers for a specified DOM element, when file drag-and-drop and AJAX upload is supported.
				 * A "dnd" CSS class is added to the DOM element on "dragenter", and removed on "dragleave".
				 * @param domElement drop target, as a DOM element.
				 * @param {function} ondrop invoked (with the event object) when data, of any type, is dropped onto the target.
				 * @returns {boolean} true if set up, otherwise false.
				 */
				setupDnd: function (domElement, ondrop) {
					if (!_.isElement(domElement)) throw new TypeError("domElement: " + domElement);
					if (!_.isFunction(ondrop)) throw new TypeError("ondrop: " + ondrop);
					if (domElement && window.FormData && ('draggable' in domElement || ('ondragstart' in domElement && 'ondrop' in domElement))) {
						var doNothing = $RT.jQuery.cancelEvent;
						domElement.addEventListener("dragover", doNothing, false);
						domElement.addEventListener("dragend", doNothing, false);
						domElement.addEventListener("dragenter", function (evt) {
							//console.log("dragenter");
							$(this).addClass('dnd');
							return doNothing(evt);
						}, false);
						domElement.addEventListener("dragleave", function (evt) {
							//console.log("dragleave");
							$(this).removeClass('dnd');
							return doNothing(evt);
						}, false);
						domElement.addEventListener("drop", ondrop, false);
						return true;
					}
					return false;
				}
			},
			Dialog: {
				/**
				 * Displays a pseudo-modal dialog, returning the result as a Promise.
				 * @param {Object} params dialog config options.
				 * @param {string} params.title the dialog title.
				 * @param {string} [params.dismiss] the dismiss button label; if undefined, no dismiss button label is displayed.
				 * @param {boolean} [params.sheet] if true, "sheet" mode is used, otherwise "viewport" mode is used.
				 * @param {number} [params.width] in sheet mode, specifies an exact pixel width to use.
				 * @param {number} [params.height] in sheet mode, specifies an exact pixel height to use.
				 * @param {Object[]} params.actions array of action definitions, either button labels or button config option objects (id, disabled, click callback).
				 * @param {function} [params.content] returns either a string or a jQuery object to use as dialog content.
				 * @param {function} [params.onDisplay] callback invoked (after rendering and before display) to wire-up events for complex dialogs. A jQuery dialog reference is passed as a parameter to the callback.
				 * @param {function} [params.onResolve] callback invoked (when a resolve action is triggered, other than dismissal) to retrieve dialog element state before disposal. A jQuery dialog reference is passed as a parameter to the callback. If the function returns a value, it is used as the promise resolution value instead of the default ID.
				 * @param {function} [params.focusSelector] returns a jQuery-compatible selector string to focus content when dialog appears.
				 * @param {boolean} [params.warn] if true, the "warn" CSS class is applied.
				 * @param {boolean} [params.overflow] if true, overflowing dialog content will be visible, if false (the default) then dialog content will automatically scroll.
				 * @returns {Promise} a promise, where the result corresponds to the selected action ID.
				 */
				create: function (params) {
					return new Promise(function (resolve, reject) {
						var $pane = $('<div class="modal-pane transparent"><div class="modal-card"><header class="primary-text-color divider-color"></header><article class="secondary-text-color"></article><footer></footer></div></div>').appendTo('body').eq(0);
						if (params.warn) {
							$pane.addClass('warn');
						}
						var $card = $pane.find('.modal-card');
						if (params.sheet === true) {
							$card.addClass('sheet');
							if (_.isNumber(params.width)) {
								$card.width(params.width);
							}
							if (_.isNumber(params.height)) {
								$card.height(params.height);
							}
						}

						// arg0: error, event, or undefined
						// arg1: custom result or undefined
						var fnDismiss = function (err, result) {
							fnDispose();
							if (_.isError(err)) {
								reject(err);
								return;
							}
							resolve(result === null || fnResolveId($pane, _.isUndefined(result) ? "dismiss" : result));
						};

						var fnResolveId = function ($pane, id) {
							try {
								var v = null;
								if (_.isFunction(params.onResolve)) {
									v = params.onResolve($pane, id);
								}
								resolve((v !== null && !_.isUndefined(v)) ? v : id);
							} catch (err) {
								fnDismiss(err);
								console.error("[%s] %O", id, err);
							}

						}

						var fnDispose = function () {
							// idempotent
							if ($pane.data('disposed')) return;
							$pane.data('disposed', true);

							$(document).off('keyup', fnDismissOnEscape);
							$card.find('button').prop('disabled', true);
							$pane.addClass('transparent');

							setTimeout(function () {
								$pane.remove();
							}, 250); // timeout must match CSS transition duration
						};

						try {
							var $header = $card.find('header');
							var $footer = $card.find('footer');
							var $article = $card.find('article');
							if (params.overflow) {
								$article.css({overflow: 'visible'});
							}

							$('<h2>').addClass('ellipsis').text(params.title).appendTo($header);

							if (_.isArray(params.actions)) {
								_.each(params.actions, function (it, i) {
									if (!_.isObject(it)) it = {label: "" + it};
									var id = _.isString(it.id) ? _.escape(it.id) : "modalCardAction_" + i;
                                    var $b;
									if (it.svg) {
                                        $b = $('<button type="button" id="' + id + '">').appendTo($footer);
                                        var $btnText = $('<div class="btn-text-wth-icon">').appendTo($b);
                                        $('<span>').text(it.label).appendTo($btnText);
                                        $('<div class="btn-icon">'+  it.svg + '</div>').appendTo($btnText);

									} else {
                                        $b = $('<button type="button" id="' + id + '">').text(it.label).appendTo($footer);
									}


									if (it.disabled === true) $b.prop('disabled', true);
									$b.click(function (evt) {
										var defaultHandler = function () {
											fnDispose();
											fnResolveId($pane, id);
										};

										if (_.isFunction(it.click)) {
											try {
												it.click(evt, this, defaultHandler, $pane, $header, $footer);
											} catch (err) {
												fnDismiss(err);
												console.error("[%s] %O", id, err);
											}
										}
										else {
											defaultHandler();
										}
									});
									if (_.isArray(it.classNames) && it.classNames.length > 0) {
										_.each(it.classNames, function (className) {
											$b.addClass(className);
										});
									}
								});
							}

							var $buttons = $footer.find('button').addClass('accent-color');

                            if (_.isString(params.dismiss)) {
                                if (params.dismissSvg) {
                                    var $b = $('<button class ="secondaryFooter" type="button">').appendTo($footer);
                                    var $btnText = $('<div class="btn-text-wth-icon">').appendTo($b);
                                    $('<span>').text(params.dismiss).appendTo($btnText);
                                    $('<div class="btn-icon">'+ params.dismissSvg + '</div>').appendTo($btnText);
                                    $b.click(fnDismiss);
                                } else {
                                    $('<button class ="secondaryFooter" type="button">').text(params.dismiss).appendTo($footer).click(fnDismiss);
                                }
							}


							if (params.warn) {
								$buttons.addClass('warn');
							}

							var fnDismissOnEscape = function (e) {
								var keyCode = (window.event) ? e.which : e.keyCode;
								if (keyCode === 27) fnDismiss();
							};

							if (_.isFunction(params.content)) {
								var content = params.content();
								if ($RT.jQuery.is(content)) {
									$article.html(content);
								}
								else {
									$article[0].innerHTML = content;
								}
							}
							else if (_.isString(params.content)) {
								$article.html($RT.Format.nl2br(_.escape(params.content)));
							}

							if (_.isFunction(params.onDisplay)) {
								// fnDismiss is provided, to enable programmatic cancellation of dialog
								params.onDisplay($pane, fnDismiss, $header, $footer);
							}

							setTimeout(function () {
								$pane.removeClass('transparent');
								$(document).on('keyup', fnDismissOnEscape);

								if (_.isFunction(params.focusSelector)) {
									var fs = params.focusSelector();
									if (_.isString(fs)) {
										$card.find(fs).focus();
										return;
									}
								}

								$footer.find('button').eq(0).focus();
							}, 25);
						} catch (err) {
							console.error("Failed to create dialog: %O", err);
							fnDismiss(err);
						}
					});
				}
			},
			Popup: {
				/**
				 * Displays a contextual pop-up, returning the result as a Promise.
				 * Can be cancelled using ESCAPE or by clicking outside the popup.
				 * @param {Object} params popup config options.
				 * @param {string} [params.title] the popup title.
				 * @param {string} [params.subtitle] the optiona popup subtitle.
				 * @param {boolean} [params.sheet] if true, "sheet" mode is used, otherwise "viewport" mode is used.
				 * @param {number} params.top specifies the absolute top pixel position
				 * @param {number} params.left specifies the absolute left pixel position
				 * @param {number} params.width specifies the exact pixel width to use, or 0 for preferred width.
				 * @param {number} params.height specifies the exact pixel height to use, or 0 for preferred height.
				 * @param {function} [params.content] returns either a string or a jQuery object to use as dialog content.
				 * @param {function} [params.items] an array of menu items, used only if "content" is undefined; each item is an object with an "id" and "label" attribute.
				 * @param {function} [params.onDisplay] callback invoked (after rendering and before display) to wire-up events for complex popups.
				 * @param {Array} [params.popupClasses] optional array of string CSS classnames to apply to ".context-popup" selector.
				 * @returns {Promise} a promise, resolving with a JavaScript object, containing a string "id" attribute (non-null if an item was selected).
				 */
				create: function (params) {
					return new Promise(function (resolve, reject) {
						if (!_.isObject(params)) {
							throw TypeError("params");
						}
						_.each(['top', 'left', 'width', 'height'], function (it) {
							var v = params[it];
							if (!_.isFinite(v)) throw new TypeError(it + ": " + v);
							params[it] = Math.round(v);
						});

						var autoWidth = params.width <= 0;
						var autoHeight = params.height <= 0;

						var $glass = $('<div class="context-glass transparent"><div class="context-popup"><header class="primary-text-color divider-color"></header><article class="secondary-text-color"></article></div></div>');
						var $popup = $glass.find('.context-popup')
							.css('left', params.left)
							.css('top', params.top)
							.width(autoWidth ? "initial" : params.width)
							.height(autoHeight ? "initial" : params.height);

						if (_.isArray(params.popupClasses)) {
							_.each(params.popupClasses, function (it) {
								if (it && _.isString(it)) $popup.addClass(it);
							});
						}

						var fnDismiss = function (err) {
							fnDispose();
							if (_.isError(err)) {
								reject(err);
								return;
							}
							resolve({id: null});
						};
						$glass.click(fnDismiss).contextmenu(fnDismiss).appendTo('body').eq(0);
						$popup.click($RT.jQuery.cancelBubble);

						var fnDispose = function () {
							// idempotent
							if ($glass.data('disposed')) return;
							$glass.data('disposed', true);

							$(document).off('keyup', fnDismissOnEscape);
							$glass.addClass('transparent');

							setTimeout(function () {
								$glass.remove();
							}, 250); // timeout must match CSS transition duration
						};

						try {
							var $header = $popup.find('header');
							if (_.isString(params.title)) {
								var t = [params.title];
								var h = [_.escape(params.title)];
								if (_.isString(params.subtitle)) {
									t.push(params.subtitle);
									if(params.sheet){
										h.push('<div class="secondary-text-color multiline">');
									}else{
										h.push('<div class="secondary-text-color ellipsis">');
									}
									h.push(_.escape(params.subtitle));
									h.push('</div>');
								}
								$header[0].innerHTML = h.join("");
								$header.attr('title', t.join("\n"));
							}
							else {
								$header.remove();
							}

							var fnDismissOnEscape = function (e) {
								var keyCode = (window.event) ? e.which : e.keyCode;
								if (keyCode === 27) fnDismiss();
							};

							var $article = $popup.find('article');

							var itemArray;

							if (_.isFunction(params.content)) {
								$article.html(params.content());
							}
							else if (_.isString(params.content)) {
								$article.html($RT.Format.nl2br(_.escape(params.content)));
							}
							else if (_.isArray(itemArray = (_.isFunction(params.items) ? params.items() : params.items))) {
								var $ul = $('<ul>').appendTo($article);
								for (var i = 0; i < itemArray.length; i++) {
									var it = itemArray[i];
									if (!_.isObject(it)) {
										// noinspection ExceptionCaughtLocallyJS
										throw new TypeError(sprintf.sprintf("item[%d]: %s", i, it));
									}

									var label = _.isString(it.label) ? it.label : i;

									$('<li>')
										.attr('id', _.isString(it.id) || _.isFinite(it.id) ? it.id : "item" + i)
										.attr('title', label)
										.text(label)
										.appendTo($ul);
								}
								$RT.jQuery.setupHoverClass($ul.find('li')).click(function () {
									fnDispose();
									resolve({id: $(this).attr('id')});
								});
							}
							else {
								// noinspection ExceptionCaughtLocallyJS
								throw new Error("no content");
							}

							if (_.isFunction(params.onDisplay)) {
								// fnDismiss is provided, to enable programmatic cancellation of dialog
								var fnResolve = function (result) {
									if (result === undefined) {
										throw new TypeError("result: undefined");
									}
									fnDispose();
									resolve(result);
								};
								params.onDisplay($popup, fnDismiss, fnResolve);
							}

							setTimeout(function () {
								var po = $popup.offset();
								var pw = $popup.width();
								var ph = $popup.height();
								var gw = $glass.width();
								var gh = $glass.height();
								if (pw + po.left > gw) {
									$popup.css('left', Math.max(0, Math.floor(gw - pw)));
								}
								if (ph + po.top > gh) {
									$popup.css('top', Math.max(0, Math.floor(gh - ph)));
								}
								$glass.removeClass('transparent');
								$(document).on('keyup', fnDismissOnEscape);
							}, 25);
						} catch (err) {
							console.error("Failed to create pop-up: %O", err);
							fnDismiss(err);
						}
					});
				}
			},
			Bubble: {
				create: function (params) {
					return new Promise(function (resolve, reject) {
						if (!_.isObject(params)) {
							throw TypeError("params");
						}
						_.each(['top', 'left', 'width', 'height'], function (it) {
							var v = params[it];
							if (!_.isFinite(v)) throw new TypeError(it + ": " + v);
							params[it] = Math.round(v);
						});

						var autoWidth = params.width <= 0;
						var autoHeight = params.height <= 0;

						var $glass = $('<div class="context-glass transparent"><div class="context-popup"><article class="secondary-text-color"></article></div></div>');
						var $popup = $glass.find('.context-popup')
							.css('left', params.left)
							.css('top', params.top)
							.width(autoWidth ? "initial" : params.width)
							.height(autoHeight ? "initial" : params.height);

						var fnDismiss = function (err) {
							fnDispose();
							if (_.isError(err)) {
								reject(err);
								return;
							}
							resolve({id: null});
						};
						var fnDismissOnEscape = function (e) {
							var keyCode = (window.event) ? e.which : e.keyCode;
							if (keyCode === 27) fnDismiss();
						};
						var fnDispose = function () {
							$(document).off('keyup', fnDismissOnEscape);
							$glass.remove();
						};

						$glass.click(fnDismiss).contextmenu(fnDismiss).appendTo('body').eq(0);
						$popup.click($RT.jQuery.cancelBubble);

						try {
							var $article = $popup.find('article');

							if (_.isFunction(params.content)) {
								$article.html(params.content());
							}
							else if (_.isString(params.content)) {
								$article.html($RT.Format.nl2br(_.escape(params.content)));
							}
							else {
								// noinspection ExceptionCaughtLocallyJS
								throw new Error("no content");
							}

							setTimeout(function () {
								var po = $popup.offset();
								var pw = $popup.width();
								var ph = $popup.height();
								var gw = $glass.width();
								var gh = $glass.height();
								if (pw + po.left > gw) {
									$popup.css('left', Math.max(0, Math.floor(gw - pw)));
								}
								if (ph + po.top > gh) {
									$popup.css('top', Math.max(0, Math.floor(gh - ph)));
								}
								$glass.removeClass('transparent');
								$(document).on('keyup', fnDismissOnEscape);
							}, 25);
						} catch (err) {
							console.error("Failed to create pop-up bubble: %O", err);
							fnDismiss(err);
						}
					});
				}
			},
			Async: {
				/**
				 * Creates a deferred store proxy, automatically cancelled if another request is received before the deferral time elapses.
				 * @param params {Object} params config options.
				 * @param {number} [params.delayMillis] deferral delay (millis), default is 2000.
				 * @param {string|function} params.storeUri URI to POST data to.
				 * @param {function} [params.afterStore] callback function to invoke after storing; invoked with data.
				 * @param {function} [params.afterError] callback function to invoke after failing to store; invoked with data, error.
				 * @returns {Object} an object with a writeable "data" property to which object data should be passed, to initiate a deferred request.
				 */
				createAsyncStore: function (params) {
					if (!_.isObject(params) || !(_.isString(params.storeUri) || _.isFunction(params.storeUri))) {
						throw new TypeError("params");
					}
					var config = {
						storeUri: params.storeUri,
						delayMillis: _.isNumber(params.delayMillis) && params.delayMillis > 0 ? params.delayMillis : 2000,
						afterStore: _.isFunction(params.afterStore) ? params.afterStore : _.noop,
						afterError: _.isFunction(params.afterError) ? params.afterError : _.noop,
						lastInvoked: 0
					};
					return {
						set data(deferred) {
							if (!_.isObject(deferred)) {
								throw new TypeError("data");
							}

							var invokedAt = new Date().getTime();
							if (invokedAt === config.lastInvoked) {
								console.warn("asyncStore: throttled %s", config.storeUri);
								return;
							}
							config.lastInvoked = invokedAt;

							setTimeout(function () {
								if (invokedAt !== config.lastInvoked) {
									return;
								}

								$RT.jQuery.post({
									url: _.isFunction(config.storeUri) ? config.storeUri() : config.storeUri,
									data: JSON.stringify(deferred),
									contentType: "application/json"
								}).then(function (result) {
									config.afterStore(deferred, result.data, result.statusCode);
								}).catch(function (fault) {
									if (fault instanceof Error) {
										config.afterError(deferred, fault.toString(), 0);
									}
									else {
										config.afterError(deferred, fault.textStatus, fault.statusCode);
									}
								});
							}, config.delayMillis);
						}
					}
				}
			}
		};
		return $RT;
	}
);