define(
	['app/home', 'app/RT', 'app/datePicker', 'jquery', 'lodash', 'moment'],
	function (home, RT, datePicker, $, _, moment) {
		"use strict";

		let ctx = null;
		let jst = null;
		let txt = RT.Text;
		let fmt = RT.Format;

		let cachedMoment = RT.Time.createMomentCache();
		let TIME_PATTERN = /^([0-9]{1,2})[ hH:.-]([0-9]{2})?$/;

		function toTime(s) {
			let match = TIME_PATTERN.exec(s);
			if (match) {
				var h = parseInt(match[1], 10);
				var m = parseInt(match[2] || "0", 10);
				if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
					return fmt.sprintf("%02d:%02d", h, m);
				}
			}
			return null;
		}

		return {
			init: function (context) {
				ctx = context;
				jst = context.jst;
			},
			invoke: function (path, oldPath, sameRoute, fnHasPathChanged) {
				home.View.actions = null;
				home.Profile.requireSofime();

				let tpl = {
					card: "sfTodo",
					popup: "sfTodoPopup"
				};
				let images = {
					expand: "ux-circle-down.svg",
                    user: "ux-user.svg",
                    update: "ux-save.svg",
                    mail: "ux-mail.svg",
                    taskDone: "ux-task-check.svg",
                    taskNA: "ux-na.svg",
                    dismissSvg : "ux-cancel.svg"

				};
				let model = {
					smallScreen: window.matchMedia("(max-width: 420px)").matches,
					moment: {
						today: moment().startOf("day")
					},
					tasksTodo: null,
					task: null,
					md: {
						client: {},
						expat: {}
					},
					tt: {
						get client() {
							var dataset = _.values(model.md.client).sort(function (a, b) {
								var x = home.Locale.compare(a.name, b.name);
								return x === 0 ? a.id - b.id : x;
							});
							dataset.unshift({
								id: 0,
								name: txt.reloCustomerAll
							});
							return dataset;
						},
						get expat() {
							var dataset = _.values(model.md.expat);
							if (_.isInteger(model.filter.client)) {
								dataset = _.filter(dataset, function (x) {
									return x.client && x.client.id === model.filter.client;
								});
							}
							dataset.sort(function (a, b) {
								var x = home.Locale.compare(a.cn, b.cn);
								return x === 0 ? a.id - b.id : x;
							});
							dataset.unshift({
								id: 0,
								getName: _.constant(txt.reloExpatAll)
							});
							return dataset;
						}
					},
					sort: {
						asc: null,
						att: null
					},
					filter: {
						client: path[3],
						expat: path[4],
						task: path[5],
					},
					rerouted: false,
					today: Date.now(),
				};

				(function () {
					let sortColumns = ["expat","client","task", "deadline"];
					let filterColumns = ["expat","task", "client"];
					let f = model.filter;

					model.sort.asc = path[1] === "asc" ? true : path[1] === "desc" ? false : null;
					if (!_.isBoolean(model.sort.asc)) model.rerouted = true;

					model.sort.att = path[2];
					if (sortColumns.indexOf(model.sort.att) < 0) {
						model.sort.att = null;
						model.rerouted = true;
					}


					_.each(filterColumns, function (k) {
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
					var f = ["client", "expat", "task"];
					var t = _.assign(_.pick(model.filter, f), _.pick(o, f));
					home.Router.go([path[0], model.sort.asc === false ? "desc" : "asc", model.sort.att || "deadline", idParam(t.client), idParam(t.expat), idParam(t.task)]);
				};
				if (model.rerouted) {
					go(model.filter);
					return;
				}

				Promise.all([
					jst.fetchTemplates(tpl),
					home.Image.Vector.fetchSVG(images),
					Promise.all([
						RT.jQuery.get({
							url: home.Route.sfExpat,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.expats = _.chain(rs.data.expatriates)
								.filter(function (x) {
									return !(x.client && x.client.marketing);
								}).value();
							_.each(model.expats, function (x) {
								model.md.expat[x.id] = x;

								if (_.isObject(x.client) && _.isInteger(x.client.id)) {
									if (_.isObject(model.md.client[x.client.id])) {
										x.client = model.md.client[x.client.id]; // overwrite duplicate definitions
									}
									else {
										model.md.client[x.client.id] = x.client;
									}
								}
								x.getName = function () {
									return this.sn && this.gn ? this.sn + ", " + this.gn : this.cn;
								};
								x.getName = x.getName.bind(x);
							});

							model.expats = model.expats.sort(function (a, b) {
								var x = (a.uncheckDocument > 0 ? 1 : 0) - (b.uncheckDocument > 0 ? 1 : 0);
								console.log("cmp x=" + x + ", num checked document=" + a.uncheckDocument);
								if (!x) x = home.Locale.compare(a.sn || "", b.sn || "");
								if (!x) x = home.Locale.compare(a.gn || "", b.gn || "");
								console.log("full cmp x=" + x);
								return x === 0 ? a.id - b.id : x;
							});
						}),
						RT.jQuery.get({
							url: home.Route.masterData,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.task = rs.data.task;
						}),
						RT.jQuery.get({
							url: home.Route.sfTaskTodo,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {
							model.tasksTodo = rs.data.tasksTodo;
							model.tasksTodo = _.filter(model.tasksTodo, function (it) {
								return ((it.welcomer === home.User.id) || (it.serviceManager === home.User.id));
							})

							_.each(model.tasksTodo, function (it) {
								/*if((it.welcomer === home.User.id) && !(it.serviceManager === home.User.id)){
									it.isOnlyWelcomer = true;
								}*/
								it.isOnlyWelcomer = (it.welcomer === home.User.id) && !(it.serviceManager === home.User.id);
							});


						})
					])
				]).then(function (/*result*/) {
					debugger;
					if (model.filter.client) {
						model.tasksTodo = _.filter(model.tasksTodo, function (it) {
							return it.expat.client && it.expat.client === model.filter.client;
						});
					}
					if (model.filter.expat) {
						model.tasksTodo = _.filter(model.tasksTodo, function (it) {
							return it.expat.id === model.filter.expat;
						});
					}
					if (fnHasPathChanged()) {
						if (!model.rerouted) {
							console.warn("Router updated; cancelled rendering of #/%s", path.join("/"));
						}
						return;
					}
					if (model.rerouted) {
						console.warn("Re-routed; cancelled rendering of #/%s", path.join("/"));
						return;
					}

					_.each(model.tasksTodo, function (it) {
						it.task = model.task[it.task];
						if(it.deadline){
							let deadlineBeforeSplit = it.deadline.split("-");
							let deadline = new Date( deadlineBeforeSplit[0], deadlineBeforeSplit[1] - 1, deadlineBeforeSplit[2]).getTime();
							if( model.today > deadline ){
								it.missedDeadline = true;
							}
						}
					});


					(function () {
						function sortByDate(a, b) {
							if (!(a.deadline && b.deadline)) {
								var nullsLast = model.sort.asc ? -1 : 1;
								if (a.deadline) return nullsLast;
								if (b.deadline) return nullsLast * -1;
								return 0;
							}

							return a.deadline > b.deadline ? 1 : a.deadline < b.deadline ? -1 : 0;
						}

						function sortByTask(a, b) {
							return home.Locale.compare(a.task.label, b.task.label);
						}

						function sortByExpat(a, b) {
							return home.Locale.compare(a.expat.cn, b.expat.cn);
						}

						function sortByClient(a,b){
							return home.Locale.compare(a.expat.client.label, b.expat.client.label);
						}

						model.tasksTodo.sort(function (a, b) {
							var x;
							switch (model.sort.att) {
								case "expat": {
									x = sortByExpat(a, b);
									if (!x) x = sortByDate(a, b);
									if (!x) x = sortByTask(a, b);
									if (!x) x = sortByClient(a, b);
									break;
								}
								case "task": {
									x = sortByTask(a, b);
									if (!x) x = sortByDate(a, b);
									if (!x) x = sortByExpat(a, b);
									if (!x) x = sortByClient(a, b);
									break;
								}
								case "client": {
									x = sortByClient(a, b);
									if (!x) x = sortByDate(a, b);
									if (!x) x = sortByTask(a, b);
									if (!x) x = sortByExpat(a, b);
									break;
								}
								default: {
									x = sortByDate(a, b);
									if (!x) x = sortByTask(a, b);
									if (!x) x = sortByExpat(a, b);
									if (!x) x = sortByClient(a, b);
								}
							}
							if (!x) x = a.id - b.id;
							if (x !== 0 && !model.sort.asc) x *= -1;
							return x;
						});
					})();

					home.View.warn = false;
					home.View.documentTitle = txt.navSfTodo;
					home.View.Pane.content[0].innerHTML = tpl.card(_.assign({
						user: home.User,
						route: home.Route,
						images: images,
						cachedMoment: cachedMoment,
						txt: txt,
						fmt: fmt
					}, model));

					var $card = home.View.Pane.content.find('div.card').eq(0);

					var controls = {
						clientExpand: $card.find('.icon.pick-client').eq(0),
						clientPicker: home.jQuery.createTypeAhead($card.find('.combo.pick-client input.combo').eq(0), {
							name: "client",
							identityKey: "id",
							displayKey: "name",
							normalize: true,
							limit: 200,
							minLength: 0,
							source: _.constant(model.tt.client),
							onSelect: function (v) {
								if (_.isObject(v) && v.hasOwnProperty("id")) {
									if (v.id !== model.filter.client) go({client: v.id});
								}
								else {
									setTimeout(setInitial.client, 10);
								}
							}
						}),
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
						})
					};

					var setInitial = {
						client: function () {
							var v = model.filter.client ? _.find(model.tt.client, function (it) {
								return it.id === model.filter.client;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.clientPicker, v || model.tt.client[0]);
						},
						expat: function () {
							var v = model.filter.expat ? _.find(model.tt.expat, function (it) {
								return it.id === model.filter.expat;
							}) : null;
							home.jQuery.setTypeAheadValue(controls.expatPicker, v || model.tt.expat[0]);
						}
					};

					(function () {
						_.each(["client", "expat"], function (k) {
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

					let $sendMail = $card.find('[data-action=sendMail]');

					RT.jQuery.setupHoverClass($sendMail).on('click', function (evt) {
						let $card = $(this);
						let outboxmailId = $card.data("xt");
						if (!_.isInteger(outboxmailId) || outboxmailId < 1) {
							throw new Error("Outbox Mail Id");
						}
						home.Router.go(["sfMailItem", outboxmailId]);
					});


					let $validate = $card.find('[data-action=validateTask]');
					RT.jQuery.setupHoverClass($validate).on('click', function(){
						let $card = $(this);
						let expatTaskId = $card.data("xt");
						RT.jQuery.get({
							url: home.Route.sfTaskTodo + expatTaskId,
							contentType: false,
							dataType: "json"
						}).then(function (rs) {

							let expatTask = rs.data.tasksTodo[0];
							let task = model.task[expatTask.task];

							let rq = {
								action: 'done',
								remarks: task.remarks ? task.remarks : null,
								deadline: task.deadline ? task.deadline : null,
								visit: task.visit ? task.visit : null,
								rdvdate: task.rdv_date ? task.rdv_date: null,
								rdvtime: task.rdv_time ? task.rdv_time: null,
								updateRemarks: false
							};

							return rq;
						}).then(function (result) {
							if (_.isObject(result) && result.action) {
								return RT.jQuery.post({
									url: home.Route.sfTaskTodo + expatTaskId,
									data: JSON.stringify(result),
									contentType: "application/json",
									dataType: false
								}).then(function (rs) {
									if (rs.statusCode !== 205) { // RESET_CONTENT
										console.warn("unexpected response update result: %O", rs.statusCode);
										throw new Error("HTTP " + rs.statusCode);
									}
									home.Router.update();
									return result;
								});
							}
							return result;
						}).catch(function (fault) {
							console.error("expat_task(%s): dialog fault", expatTaskId, fault);
							home.View.warn = true;
							setTimeout(function () {
								home.View.warn = false;
								home.Router.update();
							}, 2000);
						});
					});

					let editingTask = false;
					let $col = $card.find('[data-action=editTask]');
					RT.jQuery.setupHoverClass($col.parent())
					$col.on('click', function () {
						if( editingTask === false ){
							editingTask = true;
							let $card = $(this);
							let expatTaskId = 0;
							if(model.smallScreen){
								expatTaskId = $card.data("xt");
							}else{
								expatTaskId = $card.parent().data("xt");
							}
							if (!_.isInteger(expatTaskId) || expatTaskId < 1) {
								throw new Error("data-xt");
							}

							RT.jQuery.get({
								url: home.Route.sfTaskTodo + expatTaskId,
								contentType: false,
								dataType: "json"
							}).then(function (rs) {

								let expatTask = rs.data.tasksTodo[0];
								let expat = expatTask.expat;
								let task = model.task[expatTask.task];

								let compact = window.matchMedia("(max-width: 800px)").matches;

								if(expatTask.rdv_time){
									expatTask.rdv_time = expatTask.rdv_time.substring(0, 5);
									expatTask.rdv_time = toTime(expatTask.rdv_time);
								}

								return RT.Dialog.create({
									title: expat.cn,
									sheet: !compact,
									width: 800,
									height: 480,
									dismiss: txt.actionCancel,
									dismissSvg: images.dismissSvg,
									data: expatTask,
									actions: [{
										id: "update",
										svg : images.update,
										label: txt[compact ? "actionAccept" : "actionUpdate"]
									}, {
										id: "done",
										svg : images.taskDone,
										label: txt[compact ? "actionTaskDoneAbbrev" : "actionTaskDone"]
									}, {
										id: "na",
										svg : images.taskNA,
										label: txt[compact ? "actionTaskNAAbbrev" : "actionTaskNA"]
									}],
									content: function () {
										return tpl.popup({
											cachedMoment: cachedMoment,
											compact: compact,
											route: home.Route,
											expatTask: expatTask,
											expat: expat,
											images: images,
											task: task,
											txt: txt,
											fmt: fmt
										});
									},
									focusSelector: function () {
										return "#todo-remarks";
									},
									onDisplay: function ($pane, fnDismiss) {

										$pane.find('button#view').on('click', function () {
											fnDismiss(null, "view");
										});
										$pane.find('button#mail').on('click', function () {
											fnDismiss(null, "mail");
										});

										let $remarks = $('#todo-remarks');
										RT.jQuery.selectOnFocus($remarks);
										RT.jQuery.trimOnBlur($remarks);

										let $rdv_date = $('#todo-rdv_date')
											.on('blur change', RT.jQuery.forceDateFormat)
											.on('blur change', function () {
												var dv = RT.jQuery.dateValue($rdv_date);
												if (dv && fmt.ISO8601.re.date.test(dv)) {
													$rdv_date.data("memo", dv);
												}
												else {
													dv = $rdv_date.data("memo");
													if (dv && fmt.ISO8601.re.date.test(dv)) {
														$rdv_date.val(cachedMoment(dv).format("L"));
													}
												}
											});
										if (expatTask.rdv_date) {
											$rdv_date.data("memo", expatTask.rdv_date);
										}

										let $rdv_time = $('#todo-rdv_time');
										if (expatTask.rdv_time) {
											$rdv_time.val(expatTask.rdv_time);
										}

										$rdv_time.on('blur change', function () {
											let v1 = this.value.trim();
											let v2 = v1 ? toTime(v1) : null;
											if (v1 && v2 && v1 !== v2) {
												this.value = v2;
											}
										});

										var $rdvDatePicker = $pane.find('img.rdv_date');
										$rdvDatePicker.on('click', function () {
											var $icon = $(this);
											var $text = $('#' + $icon.data('pickDateFor'));

											datePicker.create($text, $icon, {
												title: $icon.data('pickDateTitle'),
												defaultNavigationMonth: function () {
													var dnm = RT.jQuery.dateValue($text);
													if (dnm) {
														dnm = cachedMoment(dnm);
													}
													else {
														dnm = model.moment.today;
													}
													return dnm;
												},
												navigable: function (m/*, offset*/) {
													return true;
												},
												selectable: function (m/*, mInitial*/) {
													return true;
												}
											}).then(function (result) {
												if (moment.isMoment(result)) {
													$rdv_date.data("memo", fmt.ISO8601.format(result));
													if (!$rdv_time.val()) $rdv_time.val(result.format("HH:mm:ss"));
												}
												else {
													var memo = $rdv_date.data("memo");
													if (memo && fmt.ISO8601.re.date.test(memo)) {
														$rdv_date.val(cachedMoment(memo).format("L"));
													}
												}
											}).catch(home.View.rejectHandler);
										});

										var $deadline = $('#todo-deadline')
											.on('blur change', RT.jQuery.forceDateFormat)
											.on('blur change', function () {
												var dv = RT.jQuery.dateValue($deadline);
												if (dv && fmt.ISO8601.re.date.test(dv)) {
													$deadline.data("memo", dv);
												}
												else {
													dv = $deadline.data("memo");
													if (dv && fmt.ISO8601.re.date.test(dv)) {
														$deadline.val(cachedMoment(dv).format("L"));
													}
												}
											});
										if (expatTask.deadline) {
											$deadline.data("memo", expatTask.deadline);
										}

										var $deadlinePicker = $pane.find('img.todo-deadline');
										$deadlinePicker.on('click', function () {
											var $icon = $(this);
											var $text = $('#' + $icon.data('pickDateFor'));

											datePicker.create($text, $icon, {
												title: $icon.data('pickDateTitle'),
												defaultNavigationMonth: function () {
													var dnm = RT.jQuery.dateValue($text);
													if (dnm) {
														dnm = cachedMoment(dnm);
													}
													else {
														dnm = model.moment.today;
													}
													return dnm;
												},
												navigable: function (m/*, offset*/) {
													return true;
												},
												selectable: function (m/*, mInitial*/) {
													return true;
												}
											}).then(function (result) {
												if (moment.isMoment(result)) {
													$deadline.data("memo", fmt.ISO8601.format(result));
												}
												else {
													var memo = $deadline.data("memo");
													if (memo && fmt.ISO8601.re.date.test(memo)) {
														$deadline.val(cachedMoment(memo).format("L"));
													}
												}
											}).catch(home.View.rejectHandler);
										});
									},
									onResolve: function ($pane, id) {
										if (["update", "view", "mail", "done", "na"].indexOf(id) >= 0) {
											let rq = {
												action: id,
												remarks: $('#todo-remarks').val().trim(),
												deadline: RT.jQuery.dateValue($('#todo-deadline')),
												visit: this.data.visit,
												rdvdate: RT.jQuery.dateValue($('#rdv_date')),
												rdvtime: $('#todo-rdv_time').val(),
												updateRemarks: true
											};
											debugger;
											if (!rq.deadline) {
												delete rq.deadline;
											}
											if (rq.action === "view") {
												rq.action = "update";
												rq.goView = true;
											}
											if (rq.action === "mail") {
												rq.action = "update";
												rq.goMail = true;
											}
											return rq;
										}

										return id;
									}
								});
							}).then(function (result) {
								if (_.isObject(result) && result.action) {
									editingTask = false;
									return RT.jQuery.post({
										url: home.Route.sfTaskTodo + expatTaskId,
										data: JSON.stringify(result),
										contentType: "application/json",
										dataType: false
									}).then(function (rs) {
										if (rs.statusCode !== 205) { // RESET_CONTENT
											console.warn("unexpected response update result: %O", rs.statusCode);
											throw new Error("HTTP " + rs.statusCode);
										}
										return result;
									});
								}
								return result;
							}).then(function (result) {

								var taskTodo = _.find(model.tasksTodo, function (x) {
									return x.id === expatTaskId;
								});

								if (result.goView && taskTodo) {
									home.Router.go(["sfExpatView", taskTodo.expat.id]);
								}
								else if (result.goMail && taskTodo) {
									home.Router.go(["sfMailItem", taskTodo.outboxmailId]);
								} else {
									home.Router.update();
								}
							}).catch(function (fault) {
								console.error("expat_task(%s): dialog fault", expatTaskId, fault);
								home.View.warn = true;
								setTimeout(function () {
									home.View.warn = false;
									home.Router.update();
								}, 2000);
							});

						}
						else{alert('Doubleclick')}
					});


					let $cards = $card.find('article.expat-task[data-xt]');
					$cards.on("contextmenu", function (evt) {
						var $card = $(this);
						var taskTodo = $card.data("xt");
						taskTodo = taskTodo ? _.find(model.tasksTodo, function (x) {
							return x.id === taskTodo;
						}) : null;

						if (!taskTodo) return RT.jQuery.cancelEvent(evt);

						RT.Popup.create({
							title: taskTodo.expat.cn,
							top: evt.clientY - 8,
							left: evt.clientX - 8,
							width: 0,
							height: 0,
							items: [
								{
								id: "goMail",
								label: txt.actionViewAutomail
							},{
								id: "goView",
								label: txt.actionViewExpat
							}, {
								id: "done",
								label: txt.actionTaskDone
							}, {
								id: "na",
								label: txt.actionTaskNA
							}]
						}).then(function (result) {
							if (_.isObject(result) && _.isString(result.id)) {
								switch (result.id) {
									case "goView":
										home.Router.go(["sfExpatView", taskTodo.expat.id]);
										break;
									case "goMail":
										home.Router.go(["sfMailItem", taskTodo.outboxmailId]);
										break;
									case "done":
									case "na":
										/*return*/
										RT.jQuery.post({
											url: home.Route.sfTaskTodo + taskTodo.id,
											data: JSON.stringify({
												action: result.id,
												updateRemarks: false
											}),
											contentType: "application/json",
											dataType: false
										}).then(function (rs) {
											if (rs.statusCode !== 205) { // RESET_CONTENT
												console.warn("unexpected response update result: %O", rs.statusCode);
												throw new Error("HTTP " + rs.statusCode);
											}
											home.Router.update();
											return result;
										}).catch(function (fault) {
											console.error("expat_task(%s): popup fault", taskTodo.id, fault);
											home.View.warn = true;
											setTimeout(function () {
												home.View.warn = false;
												home.Router.update();
											}, 2000);
										});
										break;
								}
							}
							return result;
						});

						return RT.jQuery.cancelEvent(evt);
					});
					if(model.filter.expat != null){
						$card.find('[data-action="goToExpat"]').on('click', function(evt){
							evt.stopPropagation();
							home.Router.go(['sfExpatView/'+ model.filter.expat]);
							return RT.jQuery.cancelEvent(evt);
						})
					}


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