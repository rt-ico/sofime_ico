define(
	['app/RT', 'jquery', 'lodash', 'moment'],
	function (RT, $, _, moment) {
		"use strict";

		return {
			/**
			 * Creates a datepicker pop-up control.
			 * @param {jQuery} $input the input selector with the date value to get and set.
			 * @param {jQuery} $control the selector for the element used to position the pop-up.
			 * @param {object} params configuration properties.
			 * @param {string} params.title title text.
			 * @param {function} [params.navigable] invoked with a "moment" instance, and an integer month offset (indicating temporal direction), returning true|false if the date can be navigated to (for month-based navigation).
			 * @param {function} [params.selectable] invoked with a "moment" instance, returning true|false if the date can be selected. A second (optional) "moment" parameter is passed if the input defines a "data-initial-value" attribute in ISO-8601 format.
			 * @param {function} [params.defaultNavigationMonth] invoked with no arguments if the current value of the specified input could not be parsed as a date, returning either a "moment" instance or a string (either YYYY-MM or YYYY-MM-DD).
			 * @returns {Promise} resolved when dismissed.
			 */
			create: function ($input, $control, params) {
				var dv = RT.jQuery.dateValue($input);

				// determine default navigation month
				var mv = dv ? moment(dv) : null;
				if (!mv && _.isFunction(params.defaultNavigationMonth)) {
					var dnm = params.defaultNavigationMonth();
					if (moment.isMoment(dnm)) {
						mv = dnm.clone();
					}
					else if (_.isString(dnm)) {
						if (RT.Format.YearMonth.re.test(dnm)) {
							dnm += "-01";
						}
						if (RT.Format.ISO8601.re.date.test(dnm)) {
							mv = moment(dnm);
						}
					}
					if (!moment.isMoment(mv) || !mv.isValid()) mv = null;
				}
				if (!moment.isMoment(mv)) mv = moment();

				var iv = $input.data('initialValue');
				iv = (iv && RT.Format.ISO8601.re.date.test(iv)) ? moment(iv) : undefined;

				var m1 = mv.clone().startOf('month');

				var defineDates = function (m1) {
					var m = m1.clone().startOf('week');
					var rows = [];
					for (var w = 1; w <= 6; w++) {
						var cols = [];
						for (var d = 1; d <= 7; d++) {
							cols.push(m);
							m = m.clone().add(1, 'd');
						}
						rows.push(cols);
					}
					return rows;
				};

				if (!_.isFunction(params.navigable)) {
					params.navigable = _.stubTrue;
				}
				if (!_.isFunction(params.selectable)) {
					params.selectable = _.stubTrue;
				}

				var offset = $control.offset();
				return RT.Popup.create({
					width: 218,
					height: 0,
					top: offset.top,
					left: offset.left,
					title: params.title,
					content: function () {
						var markup = [];
						markup.push('<table class="dp-view">');
						markup.push('<tr class="dp-month"><td class="dp-prev">←</td><th class="dp-month" colspan=6></th><td class="dp-next">→</td></tr>');

						var w, d;

						markup.push('<tr>');
						markup.push('<th class="dp-weeknum" title="' + _.escape(RT.Text.week) + '">' + RT.Text.weekAbbrev + '</th>');
						for (d = 1; d <= 7; d++) {
							markup.push('<th class="dp-weekdays d' + d + ' text-primary-color ' + (d <= 5 ? 'default' : 'dark') + '-primary-color " title="' + _.escape(RT.Text['df' + d]) + '">');
							markup.push(RT.Text['ds' + d].substring(0, 1));
							markup.push('</th>');
						}
						markup.push('</tr>');

						for (w = 1; w <= 6; w++) {
							markup.push('<tr class="dp-week w' + w + '">');
							markup.push('<td class="dp-weeknum dp-deny"> </td>');
							for (d = 1; d <= 7; d++) {
								markup.push('<td class="d' + d + '"> </td>');
							}
							markup.push('</tr>');
						}

						markup.push('</table>');
						return markup.join('');
					},
					onDisplay: function ($popup, fnDismiss, fnResolve) {
						var $view = $popup.find('table.dp-view');
						var $rows = $view.find('tr.dp-week');
						var $month = $view.find('th.dp-month');
						var $prev = $view.find('.dp-prev');
						var $next = $view.find('.dp-next');
						$prev.add($next).on('click', function () {
							var $el = $(this);
							var d = $el.data('date');
							if (d && (d = moment(d)).isValid()) {
								m1 = d;
								repaint();
							}
						});

						$rows.find('td:not(.dp-weeknum)').hover(
							function () {
								var $td = $(this);
								if (!$td.hasClass('dp-deny')) {
									$td.addClass('accent-color');
								}
							},
							function () {
								$(this).removeClass('accent-color');
							}
						).click(function () {
							var $td = $(this);
							if (!$td.hasClass('dp-deny')) {
								var d = $td.data('date');
								if (d && (d = moment(d)).isValid()) {
									fnResolve(d);
								}
							}
						});

						var defineNavDate = function ($jq, offset, m) {
							if (params.navigable(m, offset)) {
								$jq.data('date', m.format('YYYY-MM-DD'));
							}
							else {
								$jq.removeData('date').addClass('dp-deny');
							}
						};

						var repaint = function () {
							$view.find('.dp-deny:not(.dp-weeknum)').removeClass('dp-deny');
							$rows.find('.dp-pick').removeClass('dp-pick');
							$rows.find('.light-primary-color').removeClass('light-primary-color');
							$rows.find('.primary-text-color').removeClass('primary-text-color');

							var rows = defineDates(m1);
							var mm = m1.month();

							defineNavDate($prev, -1, m1.clone().subtract(1, 'M'));
							defineNavDate($next, 1, m1.clone().add(1, 'M'));

							for (var w = 0; w < 6; w++) {
								var r = rows[w];
								var $cols = $rows.eq(w).find('td');
								$cols.eq(0).text(r[0].format('WW'));
								for (var d = 0; d < 7; d++) {
									var c = r[d];
									var $c = $cols.eq(d + 1);
									$c.text(c.date());
									if (mv.isSame(c)) {
										$c.addClass('light-primary-color');
									}
									if (mm === c.month()) {
										$c.addClass('primary-text-color');
									}
									if (params.selectable(c, iv)) {
										$c.addClass('dp-pick').data('date', c.format('YYYY-MM-DD'));
									}
									else {
										$c.addClass('dp-deny').removeData('date');
									}
								}
							}

							$month.text(RT.Format.YearMonth.full([m1.year(), m1.month() + 1]));
						};
						repaint();
					}
				}).then(function (result) {
					if (moment.isMoment(result)) {
						$input.val(result.format("L")).trigger('change');
					}
					return result;
				});
			}
		};
	}
);