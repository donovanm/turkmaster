// ==UserScript==
// @name        Turkmaster (Mturk)
// @namespace   https://greasyfork.org/users/3408
// @author		DonovanM
// @description A page-monitoring web app for Mturk (Mechanical Turk) designed to make turking more efficient. Easily monitor mturk search pages and requesters and Auto-Accept the HITs you missed.
// @include     https://www.mturk.com/mturk/*
// @version     1.2
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js
// @require 	https://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

var settings = (function() {
	var	LOCAL_STORAGE = "turkmaster_settings";
	var pub = {
		sound         : true,
		animation     : true,
		preloadHits   : false,
		volume        : 50,
		notifications : true,
		alertOnly     : false,
		fontSize      : 10,
		typeface      : "Oxygen",
		desktopNotifications : false,
		canHide       : false
	}

	_load();

	function _setfontSize(val) {
		if (val >= 5 && val <= 20) {
			pub.fontSize = val;
			$("#dispatcher div").css("font-size", val + "pt");
			$(".notification_panel p").css("font-size", val + "pt");
			$("#settingsDialog, #settingsDialog div, #settingsDialog li, #settingsDialog input, #settingsDialog button").css("font-size", val + "pt");

			_save();
		}
	}

	function _setDesktopNotifications(val, callback) {
		if (val) {
			requestDesktopNotifications(function(isPermitted) {
				callback(isPermitted);
				pub.desktopNotifications = isPermitted;
				_save();
			});

			pub.desktopNotifications = false;
		} else {
			pub.desktopNotifications = false;
		}

		_save();
	}

	function _setVolume(val) {
		if (val >= 0 && val <= 100) {
			Sound.setVolume(val);
			pub.volume = val;
			_save();
		}
	}

	function _save() {
		// localStorage.setItem(LOCAL_STORAGE, JSON.stringify(pub));
		GM_setValue(LOCAL_STORAGE, JSON.stringify(pub));
	}

	function _load() {
		var values = GM_getValue(LOCAL_STORAGE);

		if (typeof values === 'undefined')
			values = localStorage.getItem(LOCAL_STORAGE);

		if (values) {
			values = JSON.parse(values);

			for (i in values)
				pub[i] = values[i];
		}
	}

	pub.setfontSize = _setfontSize;
	pub.setVolume   = _setVolume;
	pub.setDesktopNotifications = _setDesktopNotifications;
	pub.save = _save;

	return pub;
}());

var pageType = {
	MAIN      : true,	// This is so remote watcher requests don't add new watchers to multiple pages and cause mturk errors.
	DASHBOARD : false,
	HIT       : false,
	REQUESTER : false,
	SEARCH    : false
};

var loadError = false;
var wasViewed = false;
var dispatch;
var notificationPanel;

if(!('contains' in String.prototype)) {
	String.prototype.contains = function(str, startIndex) {
		return -1 !== String.prototype.indexOf.call(this, str, startIndex);
	};
}

$(document).ready(function(){
	checkPageType();
	loadFonts();
	
	if (pageType.DASHBOARD) {
		dispatch = new Dispatch();
		DispatchUI.create(dispatch);
		createDetailsPanel();
		IgnoreList.init();

		if (settings.preloadHits)
			loadDefaultWatchers();
		else
			dispatch.load();

		requestMain();
		preloadImages();
		addFormStyle();
	}
	
	if (pageType.HIT || pageType.REQUESTER || pageType.SEARCH)
		addWatchButton();
	
	notificationPanel = new NotificationPanel();
	
	// Listen to messages
	window.addEventListener('storage', onStorageEvent, false);
}); 

$(window).unload(function() {
	if (pageType.DASHBOARD && pageType.MAIN) {
		dispatch.save();
	}
});

function loadFonts() {
	WebFont.load({
		google: { families: [ 'Oxygen:400,700:latin', 'Droid Sans Mono' ] }
	});
}

function onStorageEvent(event) {
	if (event.key.substring(0,13) === "notifier_msg_")
		onMessageReceived(event.key.substring(13), JSON.parse(event.newValue).content);
}

function checkPageType() {
	// Dashboard, hit, requester, search
	if (document.URL === "https://www.mturk.com/mturk/dashboard")
		pageType.DASHBOARD = true;
	else if (document.URL.match(/https:\/\/www.mturk.com\/mturk\/(preview|accept).+groupId=.*/) !== null)
		pageType.HIT = true;
	else if (document.URL.match(/requesterId=([A-Z0-9]+)/) !== null)
		pageType.REQUESTER = true;
	else if (document.URL.match(/(searchbar|findhits)/) !== null)
		pageType.SEARCH = true;
}

function requestMain() {
	sendMessage({ header: "request_main" });
}

function preloadImages() {
	var images = [
		'https://i.imgur.com/guRzYEL.png',
		'https://i.imgur.com/5snaSxU.png',
		'https://i.imgur.com/VTHXHI4.png',
		'https://i.imgur.com/peEhuHZ.png'
	];

	$(images).each(function(){
		$('<img>')[0].src = this;
	});
}

var SettingsDialog = function() {
	var DOMElement,
	    TOGGLE = '<button class="on_off"><span>ON</span><span>OFF</span></button>';

	function _show() {
		if (!DOMElement)
			_createDOMElement()

		_getSettings();
		DOMElement.show();
		$(window).on('click', _handleWindowClick);
	}

	function _isVisible() {
		if (DOMElement)
			return DOMElement.is(":visible");
		else
			return false;
	}

	function _getSettings() {
		if (settings.sound) DOMElement.find("#soundSettings > .on_off").addClass("on");
		DOMElement.find("#volume input").val(settings.volume);
		if (settings.notifications) DOMElement.find("#notificationSettings > .on_off").addClass("on");
		if (settings.desktopNotifications) DOMElement.find("#desktopNotifications .on_off").addClass("on");
		if (settings.alertOnly) DOMElement.find("#alertOnly .on_off").addClass("on");
		if (settings.canHide) DOMElement.find("#hideable .on_off").addClass("on");
		DOMElement.find("#fontSize input").val(settings.fontSize);
		DOMElement.find("#typeface input").val(settings.typeface);
	}

	function _save() {

	}

	function _cancel() {
		DOMElement.hide();
	}

	function _createDOMElement() {
		_addStyle();
		DOMElement = $('<div id="settingsDialog"><h2>Settings</h2></div>').append(
			$('<div id="soundSettings">' + TOGGLE + '<h3>Sound</h3>\
					<ul><li id="volume">Volume (0 - 100)<input type="text" /></li></ul>\
			   </div>'),
			$('<div id="notificationSettings">' + TOGGLE + '<h3>Notifications</h3>\
					<ul>\
						<li id="desktopNotifications">' + TOGGLE + 'Desktop Notifications</li>\
						<!--li id="alertOnly">' + TOGGLE + 'Alert/Auto only</li-->\
					</ul>\
			   </div>'),
			$('<div id="fontSettings"><h3>Font</h3>\
					<ul>\
						<li id="fontSize"><input type="text" />Size (pt)</li>\
						<!--li id="typeface"><input type="text" />Typeface</li-->\
					</ul>\
			   </div>'),
			$('<div id="uiSettings"><h3>User Interface</h3>\
					<ul>\
						<li id="hideable">' + TOGGLE + 'Hideable</li>\
					</ul>\
			   </div>'),
			$('<div id="export"><h3>Backup</h3>\
					<ul>\
						<li id="export"><button class="more">...</button>Export</li>\
						<li id="import"><button class="more">...</button>Import</li>\
					</ul>\
			   </div>')
		)

		_addHandlers();

		$("body").append(DOMElement);
	}

	function _addHandlers() {
		DOMElement.on('click', function(e) {
			if (e.target.tagName === "BUTTON" || e.target.parentNode.tagName === "BUTTON")
				_handleButtonToggle(e);
		});

		DOMElement.on('change', _handleInputChange);
	}

	function _handleWindowClick(e) {
		var target = e.target;

		if (!DOMElement.is(target) && DOMElement.has(target).length === 0 && $("#settings img").get(0) !== target) {
			_cancel();
			$(window).off('click', _handleWindowClick);
		}
	}

	function _handleInputChange(e) {
		var target = $(e.target),
			value = target.val(),
			id = target.parent().attr('id');

		if (id === "volume")
			settings.setVolume(value);
		else if (id === "fontSize")
			settings.setfontSize(value);
		else if (id === "typeface")
			settings.typeface = value;
	}

	function _handleButtonToggle(e) {
		e.preventDefault();

		// Chrome returns the span as the target while FF returns the button
		var target = (e.target.tagName === "BUTTON") ? $(e.target) : $(e.target).parent(),
			value = target.hasClass("on"),
			id = target.parent().attr('id');

		if (id !== "desktopNotifications") {
			if (target.hasClass("on")) {
				target.removeClass("on");
				value = false;
			} else {
				target.addClass("on");
				value = true;
			}
		}

		if (id === "soundSettings") {
			settings.sound = value;
		} else if (id === "notificationSettings") {
			settings.notifications = value;
		} else if (id === "desktopNotifications") {
			if (value)
				target.removeClass("on");

			// Desktop notification requests require user action so we need a callback
			// for when the user responds.
			settings.setDesktopNotifications(!value, function(isPermitted) {
				if (isPermitted) {
					target.addClass("on");
				} else {
					target.removeClass("on");
					console.error("Desktop notifications are blocked.");
				}
			});
		} else if (id === "alertOnly") {
			settings.alertOnly = value;
		} else if (id === "hideable") {
			settings.canHide = value;
			setTimeout(function () { DispatchUI.setHide() }, 50);
		}

		settings.save();

		if (id === "export") {
			_showExport();
		} else if (id === "import") {
			_showImport();
		}
	}

	function _showExport() {
		var div = $('<div id="export-box" class="dialog-big"><h2>Export Watchers</h2><h3>Copy the text below. (Triple-click to highlight all)</h3><p>' + dispatch.exportWatchers() + '</p></h2></div>');
		$('<button>Close</button>')
			.click(function() { div.remove() })
			.appendTo(div);

		div.appendTo($("body"));
	}

	function _showImport() {
		var div = $('<div id="import-box" class="dialog-big"><h2>Import Watchers</h2><h3>Paste the backup text to load watchers</h3><textarea></textarea></h2></div>');
		$('<button>Save</button>')
			.click(function() { dispatch.importWatchers($("#import-box textarea").val()); div.remove() })
			.appendTo(div);
		$('<button>Close</button>')
			.click(function() { div.remove() })
			.appendTo(div);

		div.appendTo($("body"));

		div.find("textarea").focus();
	}

	function _addStyle() {
		addStyle("\
			#settingsDialog {\
				position: fixed;\
				top: 16px;\
				left: 249px;\
				background-color: #fafafa;\
				padding: 10px;\
				width: 300px;\
				font: " + settings.fontSize + "pt 'Oxygen', verdana, sans-serif;\
				border-bottom: 1px solid #DDD;\
				border-right: 1px solid #DDD;\
				border-radius: 0.3em;\
			}\
			#settingsDialog div, #settingsDialog li, #settingsDialog input, #settingsDialog button {\
				font: " + settings.fontSize + "pt 'Oxygen', verdana, sans-serif;\
			}\
			#settingsDialog > div {\
				margin: 0px 0px 0.5em;\
				border: 1px solid #eee;\
				padding: 0.75em;\
				background-color: #fff;\
			}\
			#settingsDialog h2, #settingsDialog h3 {\
				font-weight: 400;\
				margin: 0 0 0.5em;\
			}\
			#settingsDialog h2 {\
				text-align: center;\
				font-size: 140%;\
				color: #333;\
			}\
			#settingsDialog button.on_off {\
				background: none;\
				border: none;\
				padding: 0;\
				outline: none;\
				height: 1.3em;\
				margin-top: 0em;\
			}\
			#settingsDialog .on_off span { color: #333; margin: 1px; font-size: 56%; font-weight: bold; border-radius: 1.6em;  }\
			#settingsDialog .on_off span:nth-child(2) { background-color: #aeaeae; color: #fff; padding: 0.4em 0.8em; }\
			#settingsDialog .on_off.on span:nth-child(1) { background-color: #55b8ea; color: #fff; padding: 0.4em 0.8em; }\
			#settingsDialog .on_off.on span:nth-child(2) { background-color: inherit; color: #333; padding: 0 0.8em 0 0; }\
			#settingsDialog .on_off { margin-top: 6px; }\
			#settingsDialog ul { margin: 0 0 0.2em; padding: 0 0 0 1.9em }\
			#settingsDialog ul li { list-style: none; margin-bottom: 0.5em; }\
			#settingsDialog li input, #settingsDialog li button { float: right; }\
			#settingsDialog li input[type='text'] { width: 3em; font-size: 80%; margin-right: 0.8em; text-align: right; padding-right: 0.5em }\
			#settingsDialog li .more { width: 24px; border: none; color: #808080; font: bold 160% inital; line-height: 0%; transform: rotate(90deg); background-color: transparent; position: relative; top: 8px; cursor: pointer; height: 0.7em; padding: 0 0 0.65em; }\
			#settingsDialog li#typeface input { width: 8em }\
			.dialog-big { position: fixed; top: 2em; left: 50%; width: 860px; margin-left: -430px; background-color: white; padding: 2%; border: 1px solid #ddd; font-family: 'Oxygen'; box-shadow: 3px 3px 3px rgba(0, 0, 0, 0.4); border-radius: 10px; }\
			.dialog-big p { background-color: #f7f7f7; padding: 1.5em; height: 500px; overflow: scroll; }\
			.dialog-big h2, #export-box h3 { font-weight: 400 }\
			.dialog-big h2 { font-size: 170%; margin-top: 0 }\
			.dialog-big button { background-color: #cecece; color: white; padding: 3px 10px; font-family: 'Oxygen'; border: none; border-radius: 3px; font-weight: bold; transition: background-color 0.3s; margin-right: 0.5em }\
			.dialog-big button:hover { background-color: #55B8EA }\
			.dialog-big textarea { display: block; width: 100%; height: 500px; margin: 1em 1em 1em 0; }\
		");
	}

	return {
		show: _show,
		hide: _cancel,
		isVisible: _isVisible
	}
}();


function addWatchButton() {
	var type = (pageType.HIT) ? 'hit' : (pageType.REQUESTER) ? 'requester' : (pageType.SEARCH) ? 'page' : '';
	var button = $("<div>").addClass("watcher_button")
		.append($("<a>")
			.text("Watch this " + type + "?")
			.attr('href', "javascript:void(0)")
			.click(addWatcher)
		);

	function addWatcher() {
		// Get current and default values
		var time        = 60,
			auto        = true,
			alert       = false,
			name        = "",
			stopOnCatch = true;

		// Find the name if available
		if (pageType.REQUESTER) {
			if ($(".title_orange_text_bold").length > 0) {
				name = $(".title_orange_text_bold").text().match(/Created by '(.+)'/);
				name = (typeof name !== 'undefined') ? name[1] : "";
			} else if (document.URL.match(/prevRequester=/)) {
				name = document.URL.match(/prevRequester=([^&]*)/)[1];
			}
		} else if (pageType.SEARCH) {
			name = document.URL.match(/searchWords=([^&]*)/);
			
			if (name !== null) {
				name = name[1].replace('+', ' ');
				name = name.charAt(0).toUpperCase() + name.slice(1);	// Capitalize first letter
			} else {
				name = "";
			}
		} else if (pageType.HIT) {
			name = $(".capsulelink_bold > div:nth-child(1)").text().trim();
		}
		
		// Pull up a Watcher Dialog with default values set
		watcherDialog(
			{	
				name: name,
				time: time * 1000,
				type: type,
				option: {
					auto        : auto,
					alert       : alert,
					stopOnCatch : stopOnCatch
				}
			},
			function(values) {
				var id = (document.URL.match(/groupId=([A-Z0-9]+)/) || document.URL.match(/requesterId=([A-Z0-9]+)/) || [,document.URL])[1],
					watcher = {
						id          : id,
						duration    : values.time,
						type        : (type === "page") ? "url" : type,
						name        : values.name,
						auto        : values.auto,
						alert       : values.alert,
						stopOnCatch : values.stopOnCatch
					};

				sendMessage({
					header    : 'add_watcher',
					content   : watcher,
					timestamp : true
				});
			}
		);
	}

	var location;	// Location to add the watch button
	if (pageType.HIT) {
		if ($(".message.success h6").length)
			location = $(".message.success h6");
		else if ($("#javascriptDependentFunctionality").length)
			location = $("#javascriptDependentFunctionality");
		else if ($("body > form:nth-child(7) > table:nth-child(9) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1)").length)
			location = $("body > form:nth-child(7) > table:nth-child(9) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1)");
	} else if (pageType.REQUESTER || pageType.SEARCH) {
		if ($(".title_orange_text_bold").length)
			location = $(".title_orange_text_bold");
		else
			location = $(".error_title");
	}
	location.append(button);
	addFormStyle();
}


function addFormStyle() {
	addStyle("\
		#add_watcher_form {\
			position: fixed;\
			width: 600px;\
			top: 50px;\
			left: 50%;\
			margin: 50px -300px;\
			background-color: #fcfcfe;\
			border: 1px solid #aaa;\
			border-radius: 1px;\
			text-align: center;\
			}\
		#add_watcher_form h3 {\
			font: 12pt Verdana;\
			margin: 0 0 15px;\
			background-color: #def;\
			background-color: rgba(230, 230, 230, 1);\
			padding: 3px;\
			color: #111;\
			}\
		#add_watcher_form input[type='text'] {\
			font: 10pt Verdana;\
			margin: 10px 20px 0 0;\
			}\
		#add_watcher_form input[type='button'] {\
			margin-top: 20px;\
			font: 9pt Verdana;\
			color: #444;\
			background-color: #eee;\
			border: 1px solid #999;\
			}\
		#add_watcher_form input[type='button']:hover {\
			background-color: #9df;\
			}\
		#add_watcher_form p {\
			margin: 10px;\
			font: 11pt Verdana;\
			}\
		#add_watcher_form .form_buttons input {\
			margin: 5px;\
		}\
		.watcher_button { display: inline; }\
		.watcher_button a {\
			text-decoration: none;\
			font-weight: normal;\
			background-color: #CECECE;\
			color: white;\
			padding: 3px 10px;\
			border-radius: 10px;\
			font-family: 'Oxygen', verdana, sans-serif;\
			transition: background-color 0.4s;\
		}\
		.watcher_button a:hover { background-color: #55B8EA }\
		.error_title .watcher_button { display: block; margin: 15px }\
	");
}

function addStyle(styleText) {
	var style = '<style type="text/css">' + styleText + '</style>';
	$("head").append(style);
}

function loadDefaultWatchers() {
	// Add a few watchers. Won't be done like this in the future
	dispatch.isLoading = true;
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=survey&minReward=0.25&qualifiedFor=on&x=13&y=10",
		time: 60000,
		type: 'url',
		name: "Surveys $0.25 and up"})); //$.25 surveys
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=survey&minReward=0.75&qualifiedFor=on&x=13&y=10",
		time: 60000,
		type: 'url',
		name: "Surveys $0.75 and up"})); //$.75 surveys
	dispatch.add(new Watcher({
		id: "A11L036EBWKONR",
		time: 120000,
		type: 'requester',
		name: "Project Endor",
		option: {alert:true}}));	// Endor
	dispatch.add(new Watcher({
		id: "A6YG5FKV2TAVC",
		time: 300000,
		type: 'requester',
		name: "Agent Agent",
		option: {alert:true}}));	// Agent Agent
	dispatch.add(new Watcher({
		id: "A2SUM2D7EOAK1T",
		time: 120000,
		type: 'requester',
		name: 'Crowdsource'}));
	dispatch.add(new Watcher({
		id: "AKEBQYX32KM19",
		time: 120000,
		type: 'requester',
		name: 'Crowdsurf Support'}));
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=transcri&minReward=0.00&qualifiedFor=on&x=0&y=0",
		time: 60000,
		type: 'url',
		name: "Transcription HITs"})); // Transcription HITs
	dispatch.isLoading = false;
	dispatch.save();
}

function onMessageReceived(header, message) {
	if (pageType.DASHBOARD && pageType.MAIN) {
		switch(header) {
			case 'notification_viewed' :
				wasViewed = true;
				break;
			case 'add_watcher' : 
				var msg = message;
				dispatch.add(new Watcher({
					id     : msg.id,
					time   : msg.duration,
					type   : msg.type,
					name   : msg.name,
					option : {
					 	auto: msg.auto,
					 	stopOnCatch: msg.stopOnCatch,
					 	alert: msg.alert
					}
				})).start();
				break;
			case 'ignore_requester' :
				console.log("Ignore requester", message);
				IgnoreList.add(IgnoreList.REQUESTER, message.id);
				break;
			case 'mute_hit' :
				var id = message.id;
				IgnoreList.add(IgnoreList.HIT, id);
				break;
			case 'unmute_hit' :
				var id = message.id;
				IgnoreList.remove(IgnoreList.HIT, id);
				break;
			case 'request_main' :
				sendMessage({ header: "request_denied" });
				break;
			case 'request_denied' :
				dispatch.onRequestMainDenied();
				break;
			case 'show_main' :
				alert("Showing the main dashboard. (Close this Mturk page to establish a notifier in a different tab or window)");
				break;
		}
	} else if (!pageType.DASHBOARD || (pageType.DASHBOARD && !pageType.MAIN)) {

		switch(header) {
			case 'new_hits' :
				var hits = message.hits;
				
				// Re-create the hits so their methods can be used
				for(var i = hits.length; i--;) hits[i] = new Hit(hits[i]);

				// Show the hits and let the dashboard know it was seen
				if (document.hasFocus())
					sendMessage({ header: "notification_viewed" });
				notificationPanel.add(new NotificationGroup({ title: message.title, hits: hits, url: message.url }));
				break;

			case 'captcha' :
				if (document.hasFocus())
					alert("Captcha Alert!");
				break;

			case 'turkopticon' :
				// This needs a more elegant solution. If the servers start lagging we might be
				// using addTO() for the wrong group. It won't show the TO for the wrong requester,
				// though, so it's safe to use for now. It's just that some ratings could be missing.
				notificationPanel.notifications[notificationPanel.notifications.length - 1].addTO(message);
				break;
		}
	}
}
function sendMessage(message) {
	var header    = message.header;
	var content   = message.content || new Date().getTime();	// Make the content a timestamp when there's no actual content
	var timestamp = message.timestamp && new Date().getTime();	// If wanted, adds a timestamp to the content so messages with the same content will still trigger the event consecutively
	localStorage.setItem('notifier_msg_' + header, JSON.stringify({ content: content, timestamp: timestamp}));
}

function sendDesktopNotification(hits, watcher) {
	// Let's check if the user is okay to get some notification
	if (Notification.permission === "granted" && settings.desktopNotifications) {
		// If the user isn't on a mturk page to receive a rich notification, then send a web notification
		if (!wasViewed) {
			var bodyText = "";
			
			for (var i = 0, len = hits.length; i < len; i++)
				bodyText += "\n" + hits[i].title.substring(0, 40) + ((hits[i].title.length > 40) ? "..." : "") + "\n" + hits[i].reward + "\n";

			var notification = new Notification(
				watcher.name,
				{ 
					body: bodyText,
					icon: "http://halfelf.org/wp-content/uploads/sites/2/2012/06/amazon_icon.png"
				}
			);
			notification.onclick = function() {
				window.focus();					// Focus this window (dashboard)
				this.close();					// Closes the notification
				showDetailsPanel(watcher);		// Opens the details panel for whatever watcher the notification was for
			};
			notification.onshow = function() { setTimeout(function() { notification.close() }, 5000) }; // Need to set a close time for Chrome
		}
	}
}

function requestDesktopNotifications(callback) {
	// Let's check if the browser supports notifications
    if (!("Notification" in window)) {
		alert("This browser does not support desktop notification");
    } else {
		window.Notification.requestPermission(function (permission) {
			// Whatever the user answers, we make sure Chrome stores the information
			if(!('permission' in Notification))
				window.Notification.permission = permission;

			// If the user is okay, let's create a notification
			if (permission === "granted") {
				var notification = new window.Notification("Desktop notifications enabled.");
				notification.onshow = function() { setTimeout(function() { notification.close() }, 5000) };
				callback(true);
			} else {
				callback(false);
			}
		});
	}
}



function Hit(attrs) {
	attrs = attrs || {};
	this.id           = attrs.id;
	this.uid          = attrs.uid;
	this.isAutoAccept = attrs.isAutoAccept || false;
	this.requester    = attrs.requester;
	this.requesterID  = attrs.requesterID;
	this.url          = attrs.url;
	this.title        = attrs.title;
	this.reward       = attrs.reward;
	this.description  = attrs.description;
	this.available    = attrs.available;
	this.time         = attrs.time;
	this.isQualified  = (typeof attrs.isQualified !== 'undefined') ? attrs.isQualified : true;
	this.canPreview   = (typeof attrs.canPreview !== 'undefined') ? attrs.canPreview : true;
}
Hit.prototype.getURL = function(type) {
	switch(type) {
		case 'preview':
			return "https://www.mturk.com/mturk/preview?groupId=" + this.id;
		case 'accept' :
			return (this.isQualified) ? "https://www.mturk.com/mturk/previewandaccept?groupId=" + this.id : null;
		case 'auto'   :
			return "https://www.mturk.com/mturk/previewandaccept?groupId=" + this.id + "&autoAcceptEnabled=true";
		case 'view'   :
			return "https://www.mturk.com/mturk/continue?hitId=" + this.uid;
		case 'return' :
			// This will need to be changed. It's the same as 'view' until more testing is done on AMT's return functionality
			return "https://www.mturk.com/mturk/preview?hitId=" + this.uid;
		default:
			return "";
	}
};
// Returns the position of a hit in a hit array by its ID
Hit.indexOf = function(hitId, hits) {
    for (var i = 0, len = hits.length; i < len; i++) {
        if (hitId === hits[i].id)
            return i;
    }
    return -1;
};
// Returns true if there are multiple hits in the array and all of the hits are from the same requester
Hit.isSameRequester = function(hits) {
	if (hits.length > 1) {
		var compareRequester = hits[0].requester;
		for (var i = 1, len = hits.length; i < len; i++) {
			if (compareRequester !== hits[i].requester)
				return false;
		}
		return true;
	} else {
		return false;
	}
};
// Returns a list of unique requester IDs from an array of hits
Hit.getUniqueReqeusters = function(hits) {
	var ids = [];

	for (var i = 0, len = hits.length; i < len; ++i) {
		var id = hits[i].requesterID;

		if (ids.indexOf(id) === -1)
			ids.push(id)
	}

	return ids;
}

// Message object (Not used)
function Message() {
	/*  Status (changed): Unchanged, Added, Removed, Count
		We should mark each Hit in the message with what has changed. The count change should be sent with this.
		The message will also tell the client whether or not to pop-up the notification.	*/
}

// The details panel for each watcher
function createDetailsPanel() {
	var div = $('<div>').attr('id', 'details_panel').addClass('notification_panel');
	addStyle("#details_panel {\
		background-color: #fff;\
		position: absolute;\
		top: 0px;\
		margin-left: 1px;\
		left: 270px;\
		width: 500px;\
		border: 1px solid #e3e3e3;\
		border-radius: 0 0 3px 0;\
		border-width: 0 1px 1px 0;\
		transition: left 0.5s ease;\
		display: none }\
	#details_panel h4 { display: none }\
	#details_panel.left { left: 30px }");
	
	$(div).mouseleave(function() { $(this).hide() });
		
	$("body").append(div);
}

var lastWatcher = "";
function showDetailsPanel(watcher) {
	var panel = $("#details_panel");
	var group;

	// Only change the panel contents if it's a different watcher or the same one, but updated
	if (watcher !== lastWatcher || (watcher === lastWatcher && watcher.isUpdated)) {
		$("*", panel).remove();
		if (watcher.lastHits.length > 0) {
			group = new NotificationGroup({ hits: watcher.lastHits, isSticky: false, watcher: watcher });
			$(panel).append((group).getDOMElement());

			// This doesn't need a callback since the data will already be cached at this point
			group.addTO(TO.get(Hit.getUniqueReqeusters(watcher.lastHits)));
		} else {
			$(panel).append($('<div>').append('<h2>').css('text-align', 'center').html("<br />There are no HITs avaialable.<br /><br />"));
		}
	}
	$(panel).show();

	function _handleTOReceived(data) {
		group.addTO(data);
	}

	lastWatcher = watcher;
}


var IgnoreList = (function() {
	var _time = 60000,
		_hits = [];
		_requesters = [],
		_HIT = 0,
		_REQUESTER = 1;

	function _init() {
		// _clear();
		_load();
		_addListeners();
	}

	function _addListeners() {
		$(window).on('unload', function() { _save(); })
	}

	function _save() {
		localStorage.setItem('notifier_ignore', JSON.stringify(_hits));
		localStorage.setItem('notifier_ignore_requesters', JSON.stringify(_requesters));
		// console.log("Saving ignore list", _hits, _requesters);
	}

	function _load() {
		var storedHits       = localStorage.getItem('notifier_ignore');
		var storedRequesters = localStorage.getItem('notifier_ignore_requesters');

		if (storedHits !== null) {
			try {
				_hits = JSON.parse(storedHits);
			} catch (e) {
				_clear();
				_save();
				console.log("Ignored hits couldn't be loaded correctly.");
			}
		} else {
			console.log("No ignored hits found");
		}

		if (storedRequesters !== null) {
			try {
				_requesters = JSON.parse(storedRequesters);
			} catch (e) {
				_clear();
				_save();
				console.log("Ignored requesters couldn't be loaded correctly.");
			}
		} else {
			console.log("No ignored requesters found");
		}

		// console.log("Ignored requesters", _requesters);
	}

	function _clear() {
		_hits = [];
		_requesters = [];
		localStorage.removeItem('notifier_ignore');
		localStorage.removeItem('notifier_ignore_requesters');
	}

	function _contains(type, item) {
		if (type === _HIT)
			return (_hits.indexOf(item) !== -1);
		else
			return (_requesters.indexOf(item) !== -1);
	}

	function _isIgnored(requester) {
		return (_requesters.indexOf(requester) !== -1);
	}

	function _isMuted(item) {
		return (_hits.indexOf(item) !== -1);
	}

	function _filter(hits) {
		var filteredHits = [];

		for (var i = 0, len = hits.length; i < len; i++) {
			var hit = hits[i];

			if ((_hits.indexOf(hit.id) === -1) && (_requesters.indexOf(hit.requester) === -1))
				filteredHits.push(hit);
		}

		return filteredHits;
	}

	function _add(type, id) {
		if (type === _HIT) {
			if (_hits.indexOf(id) === -1)
				_hits.push(id);
		} else if (type === _REQUESTER) {
			if (_requesters.indexOf(id) === -1)
				_requesters.push(id);
		}

		_save();
	}

	function _remove(type, id) {
		if (type === _HIT) {
			var index = _hits.indexOf(id);

			if (index !== -1)
				_hits.splice(index, 1);

		} else if (type === _REQUESTER) {
			var index = _requesters.indexOf(id);

			if (index !== -1)
				_requesters.splice(index, 1);
		}

		_save();
	}

	return {
		init: _init,
		add: _add,
		remove: _remove,
		filter: _filter,
		isMuted: _isMuted,
		isIgnored: _isIgnored,
		HIT: _HIT,
		REQUESTER: _REQUESTER
	}
})();



function Evt() { /* Nothing */ };
Evt.ADD          = 1;
Evt.REMOVE       = 2;
Evt.START        = 3;
Evt.STOP         = 4;
Evt.CHANGE       = 5;
Evt.UPDATE       = 6;
Evt.HITS_CHANGE  = 7;
Evt.DELETE       = 8;
Evt.VIEW_DETAILS = 9;

Evt.prototype.addListener = function(type, callback) {
	switch(type) {
		case Evt.ADD:
			this.listener.onadd.push(callback);
			break;
		case Evt.REMOVE:
			this.listener.onremove.push(callback);
			break;
		case Evt.START:
			this.listener.onstart.push(callback);
			break;
		case Evt.STOP:
			this.listener.onstop.push(callback);
			break;
		case Evt.CHANGE:
			this.listener.onchange.push(callback);
			break;
		case Evt.UPDATE:
			this.listener.onupdate.push(callback);
			break;
		case Evt.HITS_CHANGE:
			this.listener.onhitschange.push(callback);
			break;
		case Evt.DELETE:
			this.listener.ondelete.push(callback);
			break;
		case Evt.VIEW_DETAILS:
			this.listener.onviewdetails.push(callback);
			break;
		default:
			console.error("Invalid Event type in addListener()");
	}
}

Evt.prototype.notify = function(type, data) {
	switch(type) {
		case Evt.ADD:
			this.callFunctionArray(this.listener.onadd, data);
			break;
		case Evt.REMOVE:
			this.callFunctionArray(this.listener.onremove, data);
			break;
		case Evt.START:
			this.callFunctionArray(this.listener.onstart, data);
			break;
		case Evt.STOP:
			this.callFunctionArray(this.listener.onstop, data);
			break;
		case Evt.CHANGE:
			this.callFunctionArray(this.listener.onchange, data);
			break;
		case Evt.UPDATE:
			this.callFunctionArray(this.listener.onupdate, data);
			break;
		case Evt.HITS_CHANGE:
			this.callFunctionArray(this.listener.onhitschange, data);
			break;
		case Evt.DELETE:
			this.callFunctionArray(this.listener.ondelete, data);
			break;
		case Evt.VIEW_DETAILS:
			this.callFunctionArray(this.listener.onviewdetails, data);
			break;
		default:
			console.error("Unknown event type:", type);
	}
}

Evt.prototype.callFunctionArray = function(functions, data) {
	if (functions.length > 0)
		for (var i = 0, len = functions.length; i < len; i++)
			functions[i](data);
}



var DispatchUI = {
	create: function(dispatch) {
		DispatchUI.dispatch = dispatch;
		DispatchUI.init();
		DispatchUI.addStyle();
		DispatchUI.addActions();
		DispatchUI.addListeners();
		DispatchUI.addDragAndDrop();
		return DispatchUI.div;
	},

	init: function() {
		var div = DispatchUI.div = $("<div>").attr('id', "dispatcher")
			.append($("<div>").attr('id', "controller"))
			.append($("<div>").attr('id', "watcher_container"));

		DispatchUI.watchers = [];

		// Move dashboard contents to the right and put the dispatch panel on the left
		var pageElements = $("body > *");
		$("body").html("");
		$("body").append(
			$("<div>")
				.attr('id', "content_container")
				.append($(pageElements))
		);

		$("body").css('margin', "0").prepend(div);

		var ctrl = DispatchUI.ctrl = $("#controller", div);
		var settingsBtn = $("<a>")
				.attr('id', "settings")
				.attr('href', "javascript:void(0)")
				.attr('title', "Settings")
				.html('<img />')
				.click(function() {
					if (!SettingsDialog.isVisible())
						SettingsDialog.show();
					else
						SettingsDialog.hide();
				});

		ctrl.append(
			settingsBtn,
			'<div class="play_container">\
				<div class="play_all" title="Start All"></div>\
				<div class="play selected" title="Start Selected"></div>\
				<div class="pause" title="Pause All"></div>\
			</div>',
			"Turkmaster"
		);

		// Adding the data URL inline wouldn't work for some reason, so I'm doing it this way.
		// Image from http://latierrasenosestrecha.org/wp-content/themes/purity/img/icons/settings.png
		$("img", settingsBtn)[0].src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2RpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpFRUQ3N0Q2NkUyQjJFMDExOTM4OUZBRkY5RUM4NjkxMiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQjNFQjA2OEIyRTYxMUUwOUZDRUUxRERBNzIzQkY1NyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQjNFQjA2N0IyRTYxMUUwOUZDRUUxRERBNzIzQkY1NyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3MiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpFRkQ3N0Q2NkUyQjJFMDExOTM4OUZBRkY5RUM4NjkxMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpFRUQ3N0Q2NkUyQjJFMDExOTM4OUZBRkY5RUM4NjkxMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PiP+YRgAAALDSURBVHja7FdPZB1BGJ9tawmt8HinrUQpjdBqqFaq5BChJBI5xCvVQ1mPRq89hGqkeusxpLpKDtFTqpEorUZKKdFcWo2WR7REwyOE8niUeP19/Jbxmd3NbjXv0Aw/szO733z/ft/MrNdqtUw72zHT5tZ2A04UEYqiaBTdPFAC9oDb1Wp15TAjMEflhv3cP4kAPC2j6wK24OEv61WgPg2U3El054BtyO2m6fCSqgCLDKBbBjqBHWAQ+A3cAmYcItPAAp/XgDOAGD0GI97nMgDKRel3K8yGuRbP/BSHxMCGkhMjemBEPQ8HetUica79jJT6Djlx5nxeEn4GagnvNiSswCl45UnP8UbC99vAehEOSA4/AmUrvPeBF8A9YJgEFQVvgMdABXhgRUoIeBWGbhUtw07rOWRkvgB3qNywrwKfGIVJJb9fdB+oWJ6Ih8LkRRLR1WT+JfAO+GBxonLgMkTYx9E9cxBpBLgO3OW4xt1vHTJDlIkj8oQGPFdrSBWFkFlKi8CsQ7khicat8YQolwf0qyrso4yWcVTRbFYKAofgPpTsWWRsYrzJiL2yKiNuZZLP1YIsA1ybxXEoKlmLdmB8kd6PcK7f+n7XMtZkra/PgpAHS5eaFwUrZL+0RRgRMtfD6jASwg4k7AeTefaBGda0NMnzTeBrincx0XpYDdc49xCRmi5ShpHkm89D9PRGSn5lfoJkjZU3uU6hfcDnwRK3p0zFBS5at/Iacb5fMb2Rsm8kG4Dwd6B7q8ItBj3iES0p6eNZ0Mfxa773VUWs8XTNdSERlp9NeHeZO6IYepBLT0CZ1Twp+EZCaYI1M5Q1HXJyH9jMlQJev8YoLO0HcAXoBqYS1pri+0v83lg3onru45ghLvFqVcMiDWu+5TDaUxzq/as7YcZl9afaVneg6PRhXstDVYZh0Wu5d/Rv+N8b8EeAAQBg+uBx8hdn9gAAAABJRU5ErkJggg==";
	},

	addActions: function() {
		var dispatch = DispatchUI.dispatch,
			ctrl = DispatchUI.div.find("#controller");
		$("div.play_all", ctrl).mousedown(function() {
			dispatch.start(true);
		});
		$("div.play", ctrl).mousedown(function() {
			dispatch.start();
		});
		$("div.pause", ctrl).mousedown(function() {
			dispatch.stop();
		});
	},

	addListeners: function() {
		var dispatch = DispatchUI.dispatch;
		var div = DispatchUI.div;

		dispatch.addListener(Evt.ADD, function(watcher) {
			// This could be done on one line, but then we would lose access to the WatcherUI's internal Watcher object and functionality
			var watcher = WatcherUI.create(watcher);
			$("#watcher_container", DispatchUI.div).append(watcher.element);
			DispatchUI.watchers.push(watcher);
			// watchers.push(WatcherUI.create(watcher).appendTo($("#watcher_container", div)));
		});

		dispatch.addListener(Evt.REMOVE, function(watcher) {
			// Remove watcher from array
			var index = -1,
				watchers = DispatchUI.watchers;

			for (var i = 0, len = watchers.length; i < len; i++) {
				if (watchers[i].watcher === watcher) {
					index = i;
					break;
				}
			}

			if (index !== -1)
				DispatchUI.watchers.splice(index, 1);
		});

		DispatchUI.setHide = function() {
			if (settings.canHide) {
				$(window).on('click', handleWindowClick);
			} else {
				$(window).off('click', handleWindowClick);
			}
		}

		DispatchUI.setHide();

		function handleWindowClick(e) {
			if (!div.is(e.target) && div.has(e.target).length === 0 && $(".notification_panel").has(e.target).length === 0 && !$("#settingsDialog").is(e.target) && $("#settingsDialog").has(e.target).length === 0) {
				hide();
				$(window).off('click', handleWindowClick);
				$(div).on('click', handleDivClick);
			}
		}

		function handleDivClick(e) {
			show();
			$(div).off('click', handleDivClick);

			if (settings.canHide)
				$(window).on('click', handleWindowClick);
		}

		function hide() {
			div.addClass("hidden");
			$("#content_container").addClass("full");
			$("#details_panel").addClass("left");
		}

		function show() {
			div.removeClass("hidden");
			$("#content_container").removeClass("full");
			$("#details_panel").removeClass("left");
		}
	},

	addStyle: function() {
		addStyle("#dispatcher { background-color: #f5f5f5; position: fixed; top: 0px; float: left; left: 0; height: 100%;  width: 270px; font-size: 8pt;  margin-left: 0px; transition: left 0.5s ease; }\
			#dispatcher.hidden { left: -240px }\
			#content_container { position: absolute; left: 270px; top: 0; right: 0; border-left: 2px solid #dadada; transition: left 0.5s ease; }\
			#content_container.full { left: 30px }\
			#dispatcher #controller { text-align: center; font: 160% Candara, sans-serif; color: #585858; position: relative; padding: 3px 5px; }\
			#dispatcher #controller .on_off { margin: 6px 5px 0 0 }\
			#dispatcher #controller .on_off a { font-size: 80% }\
			#dispatcher #controller #settings { top: 2px; position: absolute; right: 5px; }\
			#dispatcher #controller #settings img { width: 1.5em }\
			#dispatcher #controller .play_container { position: absolute; left: 5px }\
			#dispatcher #watcher_container { position: absolute; top: 30px; bottom: 0; overflow-y:auto; width: 100%;}\
			#dispatcher #watcher_container p { margin: 30px 0px }\
			#dispatcher #watcher_container .error_button a { text-decoration: none; color: #555; background-color: #fff; padding: 3px 10px; margin: 5px; border: 1px solid #aaa; border-radius: 2px }\
			#dispatcher #watcher_container .error_button a:hover { background-color: #def; border-color: #aaa }\
			#dispatcher div { font-size: 7pt }\
			#dispatcher .watcher {\
				box-sizing: border-box;\
				margin: 3px 3px 0;\
				background-color: #fff;\
				position: relative;\
				border-bottom: 1px solid #ddd;\
				border-right: 1px solid #ddd;\
				top: 0;\
				transition: background-color 0.5s, top 0.1s;\
				-moz-user-select: none;\
				-webkit-touch-callout: none;\
				-webkit-user-select: none;\
				-khtml-user-select: none;\
			}\
			#dispatcher .watcher.dragging { cursor: grabbing; z-index: 100; opacity: 0.8; transition: background-color 0.5s, top 0s }\
			#dispatcher .watcher div { font: " + settings.fontSize + "pt 'Oxygen', verdana, sans-serif }\
			#dispatcher .watcher.running .details { background-color: #C3ECFC; background-color: rgba(218, 240, 251, 1); }\
			#dispatcher .watcher.updated { background-color: #e8f5fc; background-color: rgba(218, 240, 251, 1) }\
			#dispatcher .watcher .details { width: 25px; text-align: center; float: right; background-color: rgba(234, 234, 234, 1); position: absolute; top: 0; bottom: 0; right: 0; font-size: 90%; color: #fff; transition: background-color 0.5s }\
			#dispatcher .watcher .details.updated { background-color: rgba(218, 240, 251, 1); background-color: #e8f5fc; background-color: rgba(220, 255, 228, 1) }\
			#dispatcher .watcher .name { font-size 130%; color: black; text-decoration: none; display: inline-block; margin-top: -3px}\
			#dispatcher .watcher .name:hover { text-decoration: underline }\
			#dispatcher .watcher.dragging .name:hover { text-decoration: none }\
			#dispatcher .watcher .time { display: block; float: left; font-size: 80% }\
			.on_off { float: right; cursor: pointer }\
			.on_off a { color: #333; margin: 1px; font-size: 56%; font-weight: bold }\
			.on_off a:nth-child(2) { background-color: #aeaeae; color: #fff; border-radius: 12px; padding: 3px 6px; }\
			.on_off.on a:nth-child(1) { background-color: #55b8ea; color: #fff; border-radius: 12px; padding: 3px 6px; }\
			.on_off.on a:nth-child(2) { background-color: inherit; color: #333; border-radius: inherit; padding: inherit; }\
			.watcher .on_off {  }\
			#dispatcher .watcher > .content { margin-right: 25px; padding: 5px 5px 5px 33px;}\
			#dispatcher .watcher .bottom { margin: 0 0 -5px; color: #aaa }\
			#dispatcher .watcher .bottom a:link { color: black; }\
			#dispatcher .watcher .bottom a:hover { color: #cef; }\
			#dispatcher .watcher .details { font-size: 150%; font-weight: bold }\
			#dispatcher .watcher .last_updated { position: absolute; right: 30px; bottom: 4px; font-size: 80% }\
			#dispatcher .watcher .icons { visibility: hidden; margin-left: 10px; bottom: 5px }\
			#dispatcher .watcher:hover .icons { visibility: visible }\
			#dispatcher .watcher .icons img { opacity: 0.2; height: 0.9em }\
			#dispatcher .watcher .icons img:hover { opacity: 1 }\
			#dispatcher .watcher .color_code { position: absolute; left: 0; top: 0; bottom: 0; width: 9px; cursor: grab;}\
			#dispatcher .watcher .color_code div { position: absolute; left: 0; top: 0; bottom: 0; width: 5px; transition: width 0.15s; }\
			#dispatcher .watcher.dragging .color_code { cursor: grabbing; }\
			#dispatcher .watcher .color_code:hover div { width: 9px }\
			#dispatcher .watcher .color_code.hit div       { background-color: rgba(234, 111, 111, .7); }\
			#dispatcher .watcher .color_code.requester div { background-color: rgba(51, 147, 255, .7); }\
			#dispatcher .watcher .color_code.url div       { background-color: rgba(57, 221, 122, .7); }\
			.watcher .play_container {\
				padding: 0px 0px 0px 12px;\
				float: left;\
				cursor: default;\
			}\
			.play, .pause, .play_all {\
				width:20px;\
				height: 20px;\
				position: relative;\
				display: block;\
			}\
			#controller .play, #controller .pause, #controller .play_all { float: left; }\
			.play:before, .play_all:before {\
				width: 0;\
				height: 0;\
				border-width: 8px 11px;\
				border-style: solid;\
				border-color: transparent transparent transparent #747474;\
				position: absolute;\
				content: '';\
				top: 3px;\
				left: 0px;\
			}\
			.play.selected:after {\
				width: 6px;\
				height: 6px;\
				border-radius: 1px;\
				position: absolute;\
				content: '';\
				background-color: #999;\
				top: 13px;\
				right: 9px;\
			}\
			.play_all:after {\
				width: 0;\
				height: 0;\
				border-width: 8px 11px;\
				border-style: solid;\
				border-color: transparent transparent transparent #999;\
				position: absolute;\
				content: '';\
				top: 3px;\
				left: 5px;\
			}\
			.watcher.running .play:before, .watcher.running .play:after, .pause:before, .pause:after {\
				width: 4px;\
				height: 15px;\
				background: #747474;\
				position: absolute;\
				content: '';\
				top: 3px;\
			}\
			.watcher.running .play:before, .pause:before {\
				left: 0px;\
				border: none;\
			}\
			.watcher.running .play:after, .pause:after {\
				left: 6px;\
			}\
			.play_select {\
				width: 6px;\
				height: 6px;\
				border: 2px solid #cecece;\
				border-radius: 2px;\
				margin-top: 2px;\
			}\
			.watcher.selected .play_select { background-color: #55b8ea; border-color: #b4e6ff; }\
			");
	},

	addDragAndDrop: function() {
		// Drag watchers
		var startY, currentBaseY, max, min, height,
			dragDiv, nextDiv, prevDiv, startPos, endPos, isDragging,
			slop = 7, currentWatcher, watchers = DispatchUI.watchers;

		DispatchUI.div.on("mousedown", ".watcher", function(e) {
			isDragging = false;

			// Get the position of the watcher in the listing
			startPos = endPos = $("#watcher_container .watcher").index(e.currentTarget);

			// Get reference to the selected watcher
			currentWatcher = watchers[startPos];
			dragDiv = currentWatcher.element;
			nextDiv = dragDiv.next();
			prevDiv = dragDiv.prev();

			// TODO Check target to prevent dragging from a component inside the watcher (i.e. buttons, links, etc.)
			height = dragDiv.outerHeight(true);

			startY = e.clientY;
			currentBaseY = dragDiv.offset().top;

			// max = Math.min($("#watcher_container").outerHeight(true), height * (DispatchUI.dispatch.watchers.length + .75)) - height;
			min = watchers[0].element.offset().top;
			max = Math.min($("#watcher_container").outerHeight(true), height * (watchers.length - 1) + watchers[0].element.offset().top);

			$(window).on("mousemove", move);
			$(window).on("mouseup", up);
		});

		function move(e) {
			var offsetY = e.clientY - startY;

			if (!isDragging && (Math.abs(offsetY) > slop)) {
				// Start dragging
				isDragging = true;

				dragDiv.addClass("dragging");
			}

			if (isDragging) {
				dragDiv.css('top', offsetY);

				var diffY = dragDiv.offset().top - currentBaseY;

				if (dragDiv.offset().top > max) {
					dragDiv.offset({ top: max });
					diffY = 0;
				} else if (dragDiv.offset().top < min) {
					dragDiv.offset({ top: min });
					diffY = 0;
				}

				if (diffY > height / 2) {
					// Move down one spot
					nextDiv.offset({ 'top': nextDiv.offset().top - height });
					nextDiv = nextDiv.nextAll(":not(.dragging)").first();
					prevDiv = (prevDiv.length) ? prevDiv.nextAll(":not(.dragging)").first() : (dragDiv !== watchers[0].element) ? watchers[0].element : watchers[1].element;

					currentBaseY += height;
					endPos++;
				} else if (-diffY > height / 2) {
					// Move up one spot
					prevDiv.offset({ 'top': prevDiv.offset().top + height });
					prevDiv = prevDiv.prevAll(":not(.dragging)").first();
					nextDiv = (nextDiv.length) ? nextDiv.prevAll(":not(.dragging)").first() : (dragDiv !== watchers[watchers.length - 1].element) ? watchers[watchers.length - 1].element : watchers[watchers.length - 2].element;

					currentBaseY -= height;
					endPos--;
				}
			}
		}

		function up(e) {
			$(window).off("mousemove", move);
			$(window).off("mouseup", up);

			if (isDragging) {
				e.preventDefault();
				dragDiv.removeClass("dragging");
				isDragging = false;

				// $("div", colorCode).css('width', '');
				dragDiv.css('cursor', '');
				dragDiv.css('z-index', '');
				dragDiv.css('opacity', '');
				$(".name", dragDiv).removeClass("no_hover");

				// Reset all watcher offsets
				$("#watcher_container .watcher").css('transition', "background-color 0.5s, top 0s");
				$("#watcher_container .watcher").css('top', '');

				setTimeout(function() { $("#watcher_container .watcher").css('transition', ''); }, 600);

				if (startPos !== endPos) {
					if (endPos > startPos)
						dragDiv.insertAfter($("#watcher_container .watcher")[endPos]);
					else
						dragDiv.insertBefore($("#watcher_container .watcher")[endPos]);

					DispatchUI.dispatch.moveWatcher(startPos, endPos);

					// Re-arrange our watchers array
					watchers.splice(startPos, 1);
					watchers.splice(endPos, 0, currentWatcher);
				}
			}
		}
	}
}

/** Dispatch object. Controls all of the watchers.

**/
function Dispatch() {
	this.watchers = new Array();
	this.isLoading = false;

	// Listeners
	this.listener = {
		onadd:		[],
		onremove:	[],
		onstart:	[],
		onstop:		[],
		onchange:	[]
	};
}
Dispatch.prototype = new Evt();
Dispatch.prototype.start = function(startAll) {
	if (this.watchers.length > 0) {
		var count = 0;
		for (var i = 0, len = this.watchers.length; i < len; i++) {
			// Don't start them all at the same time. There is a 2 second delay
			// between each start. It had to be done in a self-executing function
			// in order for the setTimeout to work properly.
			if (this.watchers[i].state.isSelected || startAll) {
				(function (watcher, x){
						watcher.timer = setTimeout(function() { watcher.start(); }, x * 0000); // Let's try 0ms
				})(this.watchers[i], count++);
			}
		}
	}
	this.notify(Evt.START, null);
}
Dispatch.prototype.stop = function() {
	// Stop all Watchers
	if (this.watchers.length > 0) {
		for (var i = 0, len = this.watchers.length; i < len; i++)
			this.watchers[i].stop();
	}
	this.interruptStart = true;
	this.notify(Evt.STOP, null)
}
Dispatch.prototype.add = function(watcher) {
	var self = this; 	 	
		 	
	watcher.addListener(Evt.CHANGE, function() { 	 	
		self.save(); 	 	
	})

	this.watchers.push(watcher);

	if (!this.isLoading) {
		this.save();
	}

	this.notify(Evt.ADD, watcher);

	// TODO Add a listener to save the watcher list after a watcher has been changed
	return watcher;
}
Dispatch.prototype.save = function() {
    if (!loadError) {
        // localStorage.setItem('notifier_watchers', JSON.stringify(dispatch.watchers, Watcher.replacerArray));
        GM_setValue('notifier_watchers', JSON.stringify(dispatch.watchers, Watcher.replacerArray));

        var lastChecked = getLastChecked(dispatch.watchers);

        if (lastChecked > 0)
	        localStorage.setItem('notifier_watchers_lastChecked', JSON.stringify(lastChecked));
    }

    function getLastChecked(watchers) {
    	var lastChecked = (watchers[0].date) ? watchers[0].date.getTime() : 0;

    	for (var i = 1, len = watchers.length; i < len; i++) {
    		if (watchers[i].isRunning)
    			return new Date.getTime();

    		if ((watchers[i].date) && (watchers[i].date.getTime() > lastChecked))
    			lastChecked = watchers[i].date.getTime();
    	}

    	return lastChecked;
    }
}
Dispatch.prototype.load = function() {
	this.isLoading = true;
	var data;
	var watchers,
		lastChecked = localStorage.getItem('notifier_watchers_lastChecked');

	data = GM_getValue('notifier_watchers');

	if (typeof data === 'undefined')
		data = localStorage.getItem('notifier_watchers');

	if (data !== null) {
		try {
			watchers = JSON.parse(data);

			try {
				lastChecked = JSON.parse(lastChecked);
			} catch(e) {
				lastChecked = null;
			}

			var now = new Date().getTime(),
				expTime = 180000,	// 3 minutes
				expired = (lastChecked !== null) ? now - lastChecked > expTime : false; // Expired if most recent watcher update happened more than x minutes before page was loaded

			// Add the watchers. Clear last hits if past the expiration time
			for(var i = 0; i < watchers.length; i++) {
				if (expired)
					watchers[i].lastHits = [];

				this.add(new Watcher(watchers[i]));
			}

		} catch(e) {
			loadError = true;
			console.log("Error loading saved list", e);
        }
	} else {
		loadDefaultHits();
	}

	this.isLoading = false;
}
Dispatch.prototype.remove = function(watcher) {
	var index = this.watchers.indexOf(watcher);

	if (index !== -1)
		this.watchers.splice(index, 1);

	watcher.delete();
	this.save();
	this.notify(Evt.REMOVE, watcher);
}
Dispatch.prototype.moveWatcher = function(from, to) {
	if ((to >= 0 && to < this.watchers.length) && (from >= 0 && from < this.watchers.length)) {
		var watcher = this.watchers.splice(from, 1);
		this.watchers.splice(to, 0, watcher[0]);
		this.save();
	}
}
Dispatch.prototype.getWatcherByProperty = function(name, value) {
	if (this.watchers.length > 0) {
		for (var i = 0, len = this.watchers.length; i < len; i++) {
			if (this.watchers[i][name] === value)
				return this.watchers[i];
		}
	}
	return null;
}
Dispatch.prototype.getWatcherIndex = function(watcher) {
	return this.watchers.indexOf(watcher);
}
Dispatch.prototype.getWatcher = function(index) {
	return this.watchers[index];
}
Dispatch.prototype.getWatcherCount = function() {
	return this.watchers.length;
}
Dispatch.prototype.hideWatchers = function() {
	$("#controller a").css('display', "none");
	$("#watcher_container").html("");
	$("#watcher_container")
		.css('background-color', "#f9f9f9")
		.css('color', "#ff6b6b")
		.css('text-align', "center").append(
			$("<p>").text("There is already a notifier running on a different page."),
			$("<p>").addClass("error_button").append(
				$("<a>")
					.html("Close")
					.attr('href', "javascript:void(0)")
					.click(function() {
						$("#dispatcher").css('display', "none");
						$("#content_container").css('left', "0px");
					}),
				$("<a>")
					.html("Show")
					.attr('href', "javascript:void(0)")
					.click(function() {
						sendMessage({ header: 'show_main' });
					})
			));
}
Dispatch.prototype.onRequestMainDenied = function() {
	pageType.MAIN = false;
	this.hideWatchers();
}
Dispatch.prototype.exportWatchers = function() {
	var watcherAttrs = ["id", "time", "type", "name", "option", "auto", "alert", "stopOnCatch", "state", "isSelected", "url"];

	return JSON.stringify(this.watchers, watcherAttrs);
}
Dispatch.prototype.importWatchers = function(data) {
	try {
		data = JSON.parse(data);
		dispatch.isLoading = true;

		for (var i = 0, len = data.length; i < len; i++) {
			var watcher = new Watcher(data[i]);

			if (!this.getWatcherByProperty('id', watcher.id) && !this.getWatcherByProperty('name', watcher.name))
				this.add(watcher);
		}

		dispatch.isLoading = false;
		dispatch.save();

		console.log("Watchers imported", dispatch.watchers);
	} catch(e) {
		console.error("Error importing watchers", e, data);
		alert("Invalid input. Try disabling word wrap on your text editor and re-copy.")
	}
}


function watcherDialog(watcher, callback) {
	var dialog = $("<div>").attr('id', 'add_watcher_form').append(
	$("<h3>").text("Add a watcher"),
	$("<p>").append(
		$("<label>").text("Name ").append(
			$("<input>").attr('id', "watcherName").attr('type', "text").val(watcher.name)),
		$("<label>").text(" Time ").append(
			$("<input>").attr('id', "watcherDuration").attr('type', "text").val(watcher.time / 1000))
		),
		(watcher.type === "hit") ?
			$("<p>").append(
				$("<input>").attr('type', "checkbox").attr('id', "autoaccept").prop('checked', watcher.option.auto),
				$("<label>").attr('for', "autoaccept").text("Auto-accept")
				)
			: "",
		(watcher.type === "hit") ?
			$("<p>").append(
				$("<input>").attr('type', "checkbox").attr('id', "stopaccept").prop('checked', watcher.option.stopOnCatch),
				$("<label>").attr('for', "stopaccept").text("Stop on accept")
				)
			: "",
		$("<p>").append(
			$("<input>").attr('type', "checkbox").attr('id', "alert").prop('checked', watcher.option.alert),
			$("<label>").attr('for', "alert").text("Alert")
			),
		$("<p>").addClass("form_buttons").append(
			$("<input>").attr('type', "button").attr('value', "Save"),
			$("<input>").attr('type', "button").attr('value', "Cancel")
			)
	);

	function save() {
		callback({
			name		: $("#watcherName", dialog).val(),
			time		: parseInt($("#watcherDuration", dialog).val(), 10) * 1000,
			alert		: $("#alert", dialog).prop('checked'),
			auto		: $("#autoaccept", dialog).prop('checked'),
			stopOnCatch	: $("#stopaccept", dialog).prop('checked')
		})

		hide();
	};

	function hide() {
		dialog.hide();
		dialog.remove();
		dialog.empty();
	}

	$("input[value='Save']", dialog).click(save);

	$("input[type='button']", dialog).click(hide);

	$(dialog).keydown(function(e) {
		switch(e.keyCode) {
			case 13:
				save();
				break;
			case 27:
				hide();
				break;
		}
	});

	$("body").append(dialog);

	if ($("#watcherName", dialog).val() === "")
		$("#watcherName", dialog).focus().select();
	else
		$("#watcherDuration", dialog).focus().select();
}


function WatcherUI() { /* Nothing */ };
WatcherUI.create = function(watcher) {
	// Create jQuery Element...
	var div = $("<div>").addClass("watcher")
		.html('<div class="details"> > </div>\
		<div class="play_container"><div class="play"></div><div class="play_select"></div></div>\
		<div class="content">\
			<a class="name" href="' + watcher.getURL() + '" target="_blank">' + ((typeof watcher.name !== 'undefined') ? watcher.name : watcher.id) + '</a>\
			<div class="bottom">\
	            <span class="time">' + (watcher.time / 1000) + ' seconds </span>\
	            <span class="icons">\
	                <a class="edit" href="javascript:void(0)"><img src="https://i.imgur.com/peEhuHZ.png" /></a>\
	                <a class="delete" href="javascript:void(0)"><img src="https://i.imgur.com/5snaSxU.png" /></a>\
	            </span>\
				<div class="last_updated" title="Last checked: ' + ((typeof watcher.date !== 'undefined') ? watcher.date.toString() : "n/a") + '">' + ((typeof watcher.date !== 'undefined') ? watcher.getFormattedTime() : "n/a") + '</div>\
			</div>\
			<div class="color_code"><div></div></div>\
		</div>');

	if (watcher.state.isSelected)
		div.addClass("selected");

	// Add listeners
	watcher.addListener(Evt.START, function() {
		div.addClass("running");
	});

	watcher.addListener(Evt.STOP, function() {
		div.removeClass("running");
	});

	watcher.addListener(Evt.UPDATE, function(e) {
		$(".last_updated", div).text(watcher.getFormattedTime()).attr('title', "Last checked: " + watcher.date.toString());
		div.addClass("updated");
		setTimeout(function() { div.removeClass("updated") }, 1000);
	});

	watcher.addListener(Evt.CHANGE, function() {
		$(".name", div).text(watcher.name).attr('href', watcher.url);
		$(".time", div).text(watcher.time / 1000 + " seconds");

		if (watcher.state.isSelected)
			$(div).addClass("selected");
		else
			$(div).removeClass("selected");
	});

	watcher.addListener(Evt.HITS_CHANGE, function() {
		$(".details", div).addClass("updated");
	});

	watcher.addListener(Evt.DELETE, function() {
		div.remove();
	});

	watcher.addListener(Evt.VIEW_DETAILS, function() {
		$(".details", div).removeClass("updated");
	});


	// Set actions
	$(".edit", div).click(showWatcherDialog);
	div.dblclick(showWatcherDialog);

	function showWatcherDialog() {
		watcherDialog(watcher, function(values) {
			watcher.setValues({
				name        : values.name,
				time        : values.time,
				alert       : values.alert,
				auto        : values.auto,
				stopOnCatch : values.stopOnCatch
			})
		});
	}

	$(".delete", div).click(function() {
		dispatch.remove(watcher);
	});

	$(".details", div).mouseover(function () {
		showDetailsPanel(watcher);
		$(this).removeClass("updated");
	});

	$("div.play_select", div).mousedown(function() {
		watcher.toggleSelected();
	});

	$("div.play", div).mousedown(function() {
		if (watcher.state.isRunning)
			watcher.stop();
		else
			watcher.start();
	});


	// Add colors for watcher type
	var colorCode = $(".color_code", div);
	if (watcher.type === 'hit') {
		colorCode.addClass("hit");
		colorCode.attr('title', "HIT Watcher");
	} else if (watcher.type === 'requester') {
		colorCode.addClass("requester");
		colorCode.attr('title', "Requester Watcher");
	} else if (watcher.type === 'url') {
		colorCode.addClass("url");
		colorCode.attr('title', "URL Watcher");
	}
	colorCode.attr('title', colorCode.attr('title') + "\nClick and drag to re-order");


	$(".delete img", div).hover(function() { $(this).attr('src', "https://i.imgur.com/guRzYEL.png")}, function() {$(this).attr('src', "https://i.imgur.com/5snaSxU.png")});
	$(".edit img", div).hover(function() { $(this).attr('src', "https://i.imgur.com/VTHXHI4.png")}, function() {$(this).attr('src', "https://i.imgur.com/peEhuHZ.png")});

	return { element: div, watcher: watcher };
}

/**	The Watcher object. This is what controls the pages that are monitored and how often

	Events:
		onStart      - The watcher has started to check the desired page with a time interval
		onStop       - The time interval has stopped
		onUpdate     - The watcher has just checked the page for hits
		onChange     - Attributes of the watcher changed, like name, interval time, etc.
		onDelete     - When a watcher has been deleted
		onHitsChange - The watcher updated and found a different set of hits from last time
		onCaptcha?   - The watcher encounters a captcha. Not sure if this should be handled by the Watcher or Loader (maybe both)

**/
function Watcher(attrs) {
	var DEFAULT_TIME = 60000;
	this.interval    = null;		// For continuous interval
	this.timer       = null; 			// For initial setTimeout
	this.newHits     = [];

	attrs = attrs || {};
	
	// Default states
	this.state = {};
	state = attrs.state || {};
	this.state.isRunning  = (typeof state.isRunning !== 'undefined') ? state.isRunning : false;
	this.state.isSelected = (typeof state.isSelected !== 'undefined') ? state.isSelected : false;
	this.state.isUpdated  = (typeof state.isUpdated !== 'undefined') ? state.isUpdated : false;

	// TODO Erase these state overwrites once we implement resuming state after a page load
	// Currently if a watcher is on when dispatch saves the watcher list, it'll still be marked as running even
	// though it wouldn't be running on page load.
	this.state.isRunning = false;
	this.state.isUpdated = false;
	
	// Required attributes
	this.id   = attrs.id;
	this.time = attrs.time || DEFAULT_TIME;
	this.type = attrs.type;
	this.name = attrs.name || this.id;
	this.lastHits = attrs.lastHits || [];
	
	// Options
	this.option = {};
	option 	= attrs.option || {};
	this.option.auto        = (typeof option.auto !== 'undefined') ? option.auto : false;
	this.option.alert       = (typeof option.alert !== 'undefined') ? option.alert : false;
	this.option.stopOnCatch = (typeof option.stopOnCatch !== 'undefined') ? option.stopOnCatch : true;

	// Figure out the URL
	this.url = attrs.url;

	if (typeof this.url === 'undefined')
		this.setUrl();

	// Listeners
	this.listener = {
		onstart       : [],
		onstop        : [],
		onupdate      : [],
		onchange      : [],
		onhitschange  : [],
		ondelete      : [],
		onviewdetails : []
	};

	return this;
}
Watcher.prototype = new Evt();
Watcher.prototype.toString = function() {
	return this.name;
}
Watcher.prototype.getHTML = function() {
	this.DOMElement = $("<div>");
	return $("<div>");
}
Watcher.prototype.getURL = function() {
	return this.url;
}
Watcher.prototype.setUrl = function() {
	switch(this.type) {
		case 'hit':
			this.url = "https://www.mturk.com/mturk/preview" + (this.option.auto ? "andaccept" : "") + "?groupId=" + this.id;
			break;
		case 'requester':
			this.url = "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&requesterId=" + this.id;
			break;
		case 'url':
			if (typeof this.url === 'undefined')
				this.url = this.id;
			
			// URL watchers get a random id because of id requirements for CSS
			this.id = "A" + Math.floor(Math.random() * 100000000);
			break;
	}
}
Watcher.prototype.setAuto = function(isAuto) {
	this.option.auto = isAuto;
	this.setUrl();
}
Watcher.prototype.isNewHit = function (hit) {
	return (this.newHits.indexOf(hit) !== -1);
}
Watcher.prototype.onChanged = function(newHits) {
	Messenger.sendHits(this, newHits);
	this.isUpdated = true;
	this.notify(Evt.HITS_CHANGE, newHits);
}
Watcher.prototype.start = function() {
	if (!this.state.isRunning) {
		var _this = this;

		// Set the interval and start right away
		this.interval = setInterval(function(){ _this.getData() }, this.time);
		this.getData();
		
		this.state.isRunning = true;

		this.notify(Evt.START, null);
	}

	return this;
}
Watcher.prototype.stop = function() {
	// Stop the interval object and the timer object
	clearInterval(this.interval);
	clearTimeout(this.timer);
	this.state.isRunning = false;

	this.notify(Evt.STOP, null);
}
Watcher.prototype.delete = function() {
	this.notify(Evt.DELETE, this);

	this.stop();
	this.listener = null;
	this.newHits  = null;
	this.lastHits = null;
}
Watcher.prototype.filterMessages = function(newHits) {
	// Determine which hits, if any, the user should be notified of
	// For now just showing new hits
	var filteredHits;

	if (typeof this.lastHits !== 'undefined' && this.lastHits.length > 0) {
		filteredHits = [];

		for (var i = 0, len = newHits.length; i < len; i++) {
			for (var j = 0, len2 = this.lastHits.length; j < len2; j++) {
				if (newHits[i].id === this.lastHits[j].id)
					break;
				
				// If we reach the end with no matches, add it to the changed hits array
				if (j === len2 - 1 )
					filteredHits.push(newHits[i]);
			}
		}
	} else {
		// If "last hits" doesn't exist, then all of the new hits should be considered new
		filteredHits = newHits;
	}
	
	this.lastHits = newHits;
	return filteredHits;
}
Watcher.prototype.toggleSelected = function() {
	if (this.state.isSelected)
		this.state.isSelected = false;
	else
		this.state.isSelected = true;

	this.notify(Evt.CHANGE, null);
}
Watcher.prototype.markViewed = function () {
	if (this.isUpdated) {
		isUpdated = false;
		this.notify(Evt.VIEW_DETAILS, null);
	}
}
Watcher.prototype.updateWatcherPanel = function() {
	this.date = new Date();
	this.notify(Evt.UPDATE, null);
}
Watcher.prototype.setValues = function(values) {
	var val = values || {};
	this.name = val.name || this.name;
	this.setAuto(val.auto);
	this.option.stopOnCatch = val.stopOnCatch;
	this.option.alert = val.alert;

	if (typeof val.time !== 'undefined' && this.time !== val.time) {
		this.time = val.time;

		if (this.state.isRunning) {
			this.stop();
			this.start();
		}
	}

	this.notify(Evt.CHANGE, null);
}
Watcher.prototype.getFormattedTime = function() {
	if (typeof this.date !== 'undefined') {
		var time = this.date;
		var str = "";
		var hours = time.getHours();
		var ampm = "am";
		
		if (hours >= 12) {
			if (hours > 12)
				hours -= 12;
			ampm = "pm";
		} else if (hours === 0) {
			hours = 12;
		}
			
		str += hours + ":" 
			+ ((time.getMinutes() < 10) ? "0" : "") + time.getMinutes() + ":"
			+ ((time.getSeconds() < 10) ? "0" : "") + time.getSeconds()
			+ ampm;
			
		return str;
	} else {
		return "N/A";
	}
}
Watcher.prototype.setHits = function(hits) {
	if (typeof hits !== 'undefined') {
		if (Object.prototype.toString.call(hits) !== '[object Array]')
			hits = new Array(hits);
		this.sendHits(hits);
	}
	this.updateWatcherPanel();
}
Watcher.prototype.sendHits = function(hits) {
	// Only send the hits if there is actually something to send
	// In the near future this will have to be changed to show when HITs go away completely
	if (typeof hits !== 'undefined' && hits.length > 0) {
		var newHits = this.newHits = this.filterMessages(hits);

		if (newHits.length) {
			this.onChanged(newHits);
		} else if (this.option.auto && !this.option.stopOnCatch) {
			this.onChanged(newHits); // Might add a different method for this case, but using onChanged for now
		}
	}
}
Watcher.prototype.getData = function() {
	var _this = this;
	Loader.load(this, this.url, function(data) { _this.onDataReceived($(data)); });
}
Watcher.prototype.onDataReceived = function(data) {
	var error = $(".error_title", data);
	if (error.length > 0) {
		if (error.text().contains("You have exceeded")) {
			console.error("Exceeded the maximum rate!");
			return;
		}
	}

	if (this.type === 'hit')
		this.setHits(this.parseHitPage(data));
	else
		this.setHits(this.parseListing(data));
}
Watcher.prototype.parseListing = function(data) {
	var hitCount = $("table:nth-child(3) > tbody:nth-child(1) > tr", data).length;
	var hits = new Array();
	var	qryUrl       = "td:nth-child(3) > span:nth-child(1) > a",
		qryTitle     = "td:nth-child(1) > a:nth-child(1)",
		qryRequester = "td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > a",
		qryReward    = "td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > span:nth-child(1)",
		qryAvailable = "td:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(2)",
		qryTime      = "td:nth-child(2) > table > tbody > tr:nth-child(2) > td:nth-child(2)";

	for (var i = 0; i < hitCount; i++) {
		// Get nearby ancestors so jQuery won't have to do a full search for each element (faster)
		var base    = $("table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(" + (i+1) + ") > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1)", data),
			topRow  = $("tr:nth-child(2) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1)", base),
			content = $("tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1)", base);

		var hit = new Hit();
		hit.requester   = $(qryRequester, content).text();
		hit.requesterID = $(qryRequester, content).attr("href").match(/requesterId=([A-Z0-9]+)/)[1];
		hit.title       = $(qryTitle, topRow).text().trim();
		hit.reward      = $(qryReward, content).text().trim();
		hit.available   = $(qryAvailable, content).text().trim();
		hit.time        = $(qryTime, content).text().trim();
		
		var urlData = $(qryUrl, topRow);
		hit.url = urlData.attr("href");

		var idMatch = hit.url.match(/(group|notqualified\?hit|requestqualification\?qualification)Id=([A-Z0-9]+)/);

		if (idMatch !== null) {
			hit.id = idMatch[2];
		}
		
		hit.canPreview = false;
		
		// Check each link to see if user is qualified or can preview the HIT, etc.
		urlData.each(function() {
			if (typeof this.href !== 'undefined') {
				if (this.href.contains("qual"))
					hit.isQualified = false;
				else if (this.href.contains("preview"))
					hit.canPreview = true;
			}
		});
		hits[i] = hit;
	}

	return hits;
}
Watcher.prototype.parseHitPage = function(data) {
	var msgbox = $("#alertboxHeader", data);
	var hasCaptcha = ($(data).length > 0) ? ($(data).text()).contains("In order to accept your next HIT") : false;
	
	if ($(msgbox).length > 0 && ($(msgbox).text()).contains("There are no more available HITs in this group.")) {
		// If there aren't any more available, keep checking. If they were just previously available
		// then we should alert the user that it's gone.
	} else {
		// If it's newly available, alert the user and start auto-stacking if that's desired.
		//TODO We need to test for "You are not qualified to accept this HIT."
		
		if (hasCaptcha) {
			console.log("Has captcha");
			sendMessage({header: 'captcha'});
		}

		var uid = $("input[name='hitId']", data).attr("value");
		var hit = new Hit({id: this.id, uid: uid, isAutoAccept: this.option.auto});
		hit.requester = $("form:nth-child(7) > div:nth-child(9) > div:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)", data).text().trim();
		hit.title     = $(".capsulelink_bold > div:nth-child(1)", data).text().trim();
		hit.reward    = $("td.capsule_field_text:nth-child(5) > span:nth-child(1)", data).text().trim();
		hit.available = $("td.capsule_field_text:nth-child(8)", data).text().trim();
		hit.time      = $("td.capsule_field_text:nth-child(11)", data).text().trim();
		
		if ((hasCaptcha || (this.option.auto && this.option.stopOnCatch)) && this.state.isRunning)
			// We should probably toggle off all auto-accept hits when we encounter a captcha. Maybe send a special message to all mturk windows while we're at it.
			// The special message could be some kind of banner that says that no more hits can be accepted in the background until the captcha is entered. (It would
			// be pretty cool if we could pull up the captcha image in the background and just show it and the form to enter it from another page).
			this.stop();
		
		return new Array(hit);
	}
}
Watcher.replacerArray = ["id", "time", "type", "name", "option", "auto", "alert", "stopOnCatch", "state", "isRunning", "isSelected", "isUpdated", "url", "lastHits"];

var Messenger = function() {
	var SEND_HITS = "new_hits";
	var SEND_TO = "turkopticon";
	var notificationGroup;

	function _sendHits(watcher, hits) {
		// Pass through ignore filters
		hits = IgnoreList.filter(hits);

		if (hits.length) {
			var toData = TO.get(Hit.getUniqueReqeusters(hits), _handleTOReceived);

			if (settings.notifications) {
				// Set wasViewed to false to check if any receiving windows were focused when this was sent.
				wasViewed = false;

				// Send Hits
				sendMessage({ header: SEND_HITS, content: { 'title': watcher.name, 'hits': hits, 'url': watcher.url } });

				// Get TO and send it
				if (toData)
					sendMessage({ header: SEND_TO, content: toData });

				// Attempt to send a browser notification after a brief period of time. If another mturk
				// page was visible when it received the hits, this will cancel out.
				if (!document.hasFocus())
					setTimeout(function() { sendDesktopNotification(hits, watcher); }, 200);
			}

			// Show notification on dashboard, too
			notificationGroup = notificationPanel.add(new NotificationGroup({ title: watcher.name, hits: hits, url: watcher.url }));
			notificationGroup.addTO(toData);

			// Sound alert for auto-accept HIT watchers and watchers that have the alert set on
			if (watcher.option.auto || watcher.option.alert)
				Sound.alert(watcher);

		} else {
			if (watcher.option.auto && !watcher.option.stopOnCatch)
				Sound.alert(watcher);
		}
	}

	function _handleTOReceived(data) {
		// console.log("TurkOpticon data", JSON.stringify(JSON.parse(data), null, 4));
		sendMessage({ header: SEND_TO, content: data });

		if (data) 
			notificationGroup.addTO(data);
	}

	return {
		sendHits: _sendHits
	}

}();


/** Watcher Stack and Queue
	Stack - Grab as many as possible right away
		Limit - The number of HITs to stack at once
			Stop - Stop after the limit is reached
			Queue - Start queing after the limit is reached
			
	Queue - Grab one at a time, paced about as fast as they can be done
**/


// Loader. This is what loads pages in the background. Page requests get added to a queue
// so we can load pages in moderation to avoid exceeding the maximum request rate.
// 
// Public methods:
// - load(watcher, url, callback) is the only "public" method. The callback receives the data from
//	 the requested page.

var Loader = function() {
	var queue        = [],
		pauseTime    = 2000,	// The amount of time to pause (in milliseconds)
		intervalTime = 200,	// The amount of time between page loads
		count        = 0,
		paused       = true,
		maxLoad      = 6;	// The max number of pages to load without pausing

	function _load(watcher, url, callback) {
		if (!_isQueued(watcher)) {
			queue.push({url: url, callback: callback, watcher: watcher});

			// If queue length is now 1 and was paused, it means we should resume loading
			if (queue.length === 1 && paused) {
				paused = false;
				_next();
			}
		}
	}
	
	// Checks to see if the watcher is already queued
	function _isQueued(watcher) {
		if (queue.length > 0) {
			for (var i = 0, len = queue.length; i < len; i++)
				if (queue[i].watcher === watcher)
					return true;
		}
		return false;
	}

	// GETs thet next URL in the queue
	function _next() {
		if (queue.length > 0) {
			var info = queue.shift();
			_getData(info.url, info.callback);
		} else {
			paused = true;
		}
	}

	function _getData(url, callback) {
		$.get(url, function(data) {
			callback(data);

			if (++count < maxLoad) {
				setTimeout(_next, intervalTime);
			} else {
				paused = true;
				count = 0;
				setTimeout(function() {
					if (paused)
						_next();
				}, pauseTime);
			}
		})
	}

	return {
		load: _load
	}
}();

var TO = function() {
	var URL_PREFIX = "https://api.turkopticon.istrack.in/multi-attrs.php?ids=",
		cache = {};

	setInterval(function() { cache = {}; }, 3600000); // Clear cache once per hour

	function _get(ids, callback) {
		var results = _getFromCache(ids);

		// If not all requesters found in storage, fetch from server
		if (results.missing.length > 0)
			_fetchFromServer(URL_PREFIX + results.missing.join(','), callback);

		return JSON.stringify(results.found);
	}

	function _getFromCache(ids) {
		var sorted = { found: {}, missing: [] };

		for (var i = 0, len = ids.length; i < len; i++) {
			if (cache[ids[i]])
				sorted.found[ids[i]] = cache[ids[i]];
			else
				sorted.missing.push(ids[i]);
		}

		return sorted;
	}

	function _fetchFromServer(url, callback) {
		$.get(url, function(data) {
			_cache(data);

			if (typeof callback === 'function')
				callback(data);
		})
	}

	function _getCount(obj) {
		var count = 0;

		for (key in obj)
			count++;
	}

	function _cache(data) {
		var ratings = JSON.parse(data);

		for (id in ratings) {
			cache[id] = ratings[id];
		}
	}

	return {
		get: _get
	}
}();

/** The NotificationPanel object. This holds and manipulates incoming notification groups

**/
function NotificationPanel() {
	this.isHidden      = true;
	this.notifications = new Array();
	this.createPanel();
	this.isHovered     = false;
	this.timeout       = null;
}
NotificationPanel.prototype.add = function(notification) {
	var _this = this;
	
	// Get rid of the leftover notification if there's one there
	if (this.notifications.length > 0 && this.notifications[0].hasTimedOut && !this.notifications[0].isHovered) {
		var oldNotification = this.notifications[0];
		setTimeout(function() { _this.onTimeoutListener(oldNotification);}, 1500);
	}

	// Cancel delayed timeout from mouseout (so panel won't close right after a new
	// notification comes in)
	clearTimeout(this.timeout);

	notification.onTimeout = function() { _this.onTimeoutListener(notification) };
	this.notifications.push(notification);
	this.addToPanel(notification);

	if (this.isHidden) {
		this.show();
	}

	return notification;
}

NotificationPanel.prototype.remove = function(notification) {
	// Don't remove the notification if the user has their mouse hovering over it.
	// The notification will trigger onTimeout later on mouseout which will call
	// this method again for removal.
	if (!notification.isHovered) {
		this.removeFromPanel(notification);

		var newArray = new Array();
		for (var i = 0, len = this.notifications.length; i < len; i++)
			if (this.notifications[i] !== notification)
				newArray.push(this.notifications[i]);
				
		this.notifications = newArray;
	}
}
NotificationPanel.prototype.show = function() {
	if (this.isHidden) {
		this.getDOMElement().removeClass("hidden");
		this.isHidden = false;
	}
}
NotificationPanel.prototype.hide = function() {
	if (!this.isHidden && !this.isHovered) {
		this.getDOMElement().addClass("hidden");
		this.isHidden = true;
	}
}
NotificationPanel.prototype.createPanel = function() {
	var _this = this;
	var panel =	$('<div class="notification_panel hidden" id="receiver"></div>')
			.hover(
				function() {
					clearTimeout(this.timeout);
					_this.isHovered = true;
					_this.show()
				},
				function(){ 
					_this.isHovered = false;
					this.timeout = setTimeout(function() { _this.hide() }, 1500); // Delay hiding the panel
				}
			)

	$("body").append(panel);
	
	this.DOMElement = panel;

	addStyle("\
		.notification_panel div, .notification_panel p { font: " + settings.fontSize + "pt 'Oxygen', verdana, sans-serif; }\
		#receiver.notification_panel { \
			position      : fixed;\
			width         : 400px;\
			bottom        : 0px;\
			right         : 0px;\
			background    : rgba(255, 255, 255, 1);\
			padding       : 5px;\
			border        : 1px solid #d5d5d5;\
			border-size   : 1px 0 0 1px;\
			overflow      : auto;\
			border-radius :  5px 0 0 0;\
			border-right  : 0;\
			transition    : right 0.2s;\
		}\
		#receiver.notification_panel.hidden {\
			right: -395px;\
		}\
		#receiver .notification_group {\
			background : #fdfdfd;\
			border     : 1px solid #eaeaea;\
			padding    : 5px;\
			margin     : 10px 0;\
			opacity    : 1;\
			overflow   : hidden;\
			transition : opacity 0.7s, max-height 0.2s ease-in-out 0.7s, margin 0.2s linear 0.7s, padding 0.2s linear 0.7s;\
			border-right-color  : #dedede;\
			border-bottom-color : #dedede;\
		}\
		#receiver .notification_group.removed {\
			opacity    : 0;\
			max-height : 0;\
			padding    : 0;\
			margin     : 0;\
		}\
		#receiver .notification_group h3 { margin: 3px; font-weight: normal }\
		#receiver .notification_group h3 a:link, #receiver .notification_group h3 a:visited { color: #333 }\
		#receiver .notification_group h4 a:link,\
		#receiver .notification_group h4 a:visited { margin: 2px 0 0 4px; color: #222; }\
		.notification_panel h2, #details_panel h2 { font-size: 100%; font-weight: normal; margin: 0px }\
		.notification {\
			padding          : 5px 3px 0 5px;\
			background-color : #fff;\
			border-bottom    : 1px solid #e9e9e9;\
			position         : relative;\
			margin-left      : 5px;\
		}\
		.notification:last-child { border: none; padding-bottom: 3px }\
		.notification .mute {\
			position  : absolute;\
			bottom    : 6px;\
			right     : 5px;\
			color     : #999;\
			cursor    : pointer;\
			font-size : 76%;\
		}\
		.notification a.requester:link, .notification a.requester:visited {\
			margin-top  : 2px;\
			color       : black;\
			font-size   : 80%;\
			font-weight : bold;\
		}\
		#details_panel .notification.ignored {\
			opacity: 0.4;\
		}\
		#receiver .notification.ignored {\
			display: none;\
		}\
		.notification .ignore {\
			font-size: 60%;\
			color: #999;\
			visibility: hidden;\
			cursor: pointer;\
		}\
		.notification:hover .ignore {\
			visibility: visible;\
		}\
		.notification .extra_info {\
			font-style : italic;\
			font-size  : 80%;\
			color      : #505050;\
			cursor     : default;\
		}\
		.notification_panel a:link, .notification_panel a:visited {\
			text-decoration : none;\
			color           : #6bf;\
		}\
		.notification_panel a.title:link, .notification_panel a.title:visited {\
			display       : block;\
			white-space   : nowrap;\
			overflow      : hidden;\
			text-overflow : ellipsis;\
			font-size     : 102%;\
		}\
		.notification_panel .links {\
			position : absolute;\
			bottom   : 6px;\
			right    : 35px;\
		}\
		.notification_panel a.hit_link {\
			font-size     : 70%;\
			color         : #fff;\
			background    : none repeat scroll 0% 0% #55B8EA;\
			border-radius : 12px;\
			display       : inline;\
			margin        : 10px 5px 0px 0px;\
			padding       : 3px 9px;\
			font-weight   : bold;\
			transition    : background-color 0.25s;\
		}\
		.notification_panel a.hit_link:visited { background-color: #9df; }\
		.notification_panel a.hit_link:hover { background: #8df; }\
		.notification_panel p {	margin: 3px 0 6px 0; font-size: 80%; cursor: default }\
		.notification_panel .autoaccept {\
			background-color : rgba(148, 236, 255, .3);\
			background-color : rgba(214, 255, 91, 1);\
			background-color : rgba(252, 255, 143, 1);\
		}\
		.notification.not_qualified { background-color: rgba(245, 244, 229, 1) }\
		.notification_panel .new { background-color: rgba(220, 255, 228, 1); }\
		.notification_panel .ratings-button {\
			float: left;\
			margin-right: 0.3em;\
			height: 0.7em;\
			width: 0.7em;\
			background-color: #93C9FF;\
			border-radius: 3px;\
			font-size: 80%;\
			position: relative;\
			top: 0.6em;\
		}\
		.notification_panel .ratings.no-TO .ratings-button {\
			background-color: #ccc;\
		}\
		.notification_panel .ratings-button > .ratings-chart {\
			position: absolute;\
			bottom: -3em;\
			left: 0.4em;\
			background-color: rgb(255, 255, 255);\
			color: #444;\
			visibility: hidden;\
			padding: 0.3em;\
			border: 1px solid #f0f0f0;\
			z-index: 100;\
		}\
		.notification_panel .ratings-button:hover > .ratings-chart { visibility: visible; }\
		.notification_panel .ratings.no-TO .ratings-button > .ratings-chart { bottom: -1em; }\
		.notification_panel .ratings-chart table { border-collapse: collapse; }\
		.notification_panel .ratings-chart td { font-family: 'Oxygen',verdana,sans-serif; font-size: 70%; color: #444; padding: 0 2em 0 0; cursor: default; vertical-align: center }\
		.notification_panel .ratings-chart td:nth-child(3) { font-family: 'Droid Sans Mono',fixed-width; font-size: 60%; white-space: nowrap }\
		.notification_panel .ratings-chart p { font-size: 80%; padding: 0 2em 0 0; margin: 0.5em 0 0; white-space: nowrap }\
		.notification_panel .ratings-chart .light { opacity: 0.6 }\
		.notification_panel .ratings.no-TO .ratings-chart { padding: 0.5em }\
		.notification_panel .ratings-chart .rating { padding: 0.3em 0 0 }\
		.notification_panel .ratings-chart .rating > div { background-color: #eee; height: 0.5em; width: 13em; margin: 0 0.5em 0 0; border-radius: 4px }\
		.notification_panel .ratings-chart .rating > div > div { background-color: #55B8EA; height: 100%; border-radius: 4px }\
		");
}
NotificationPanel.prototype.getDOMElement = function() {
	return this.DOMElement;
}
NotificationPanel.prototype.addToPanel = function(notification) {
	$(this.getDOMElement()).prepend(notification.getDOMElement());
}
NotificationPanel.prototype.removeFromPanel = function(notification) {
	$(notification.getDOMElement()).remove();
}
NotificationPanel.prototype.onTimeoutListener = function(notification) {
	if (this.notifications.length > 1) {
		var _this = this;
		if (document.hasFocus() && settings.animation) {
			notification.fadeOut();
			setTimeout(function() { _this.remove(notification) }, 905);
		} else {
			setTimeout(function() { _this.remove(notification) }, 705);
		}
	} else {
		this.hide();
	}
}


/** The NotificationGroup object. This holds groups of Notifications and interacts 
	directly with the NotificationPanel
**/
function NotificationGroup(obj) { // title, hits, isSticky, watcher, url
	this.title       = obj.title || null;
	this.hits        = obj.hits;
	this.isSticky    = (typeof obj.isSticky !== 'undefined') ? obj.isSticky : this.hasAutoAccept();
	this.url         = obj.url;
	this.timeout     = (this.isSticky) ? 15000 : 6000;
	this.hasTimedOut = false;
	this.isHovered   = false;

	if (typeof obj.watcher !== 'undefined') this.watcher = obj.watcher;
	
	var _this = this;
	setTimeout(function() {
		if (typeof _this.onTimeout !== 'undefined' && _this.onTimeout !== null) {
			_this.hasTimedOut = true;

			if (!_this.isHovered)
				_this.onTimeout(_this);
		}
	}, this.timeout);

	if (typeof this.hits[0] === 'undefined')
		console.error("Error, no hits for notification", document.URL, obj);

	this.createDOMElement();
}
NotificationGroup.prototype.addTO = function(data) {
	if (data !== "{}") {
		var ratings = JSON.parse(data);
		var group = this.getDOMElement();

		var notifications = group.find(".notification"),
			singleRequester = group.find("h4 .requester");

		if (singleRequester.length > 0) {
			var id
			for (var i in ratings)
				id = i;

			this.appendRatings({ notification: singleRequester.parent(), id: id, ratings: ratings[id] });
		}

		for (var id in ratings) {
			currentNotification = notifications.filter(function() { return $(this).data("requesterID") === id });
			this.appendRatings({ notification: currentNotification, id: id, ratings: ratings[id] });
		}
	}
}
NotificationGroup.prototype.appendRatings = function(obj) {
	var notification = obj.notification,
		requesterID  = obj.id,
		ratings      = obj.ratings,
		attrs        = ratings.attrs,
		requesterEl  = notification.find(".requester");

	// Would be nice to have a chart-looking icon
	var element = $('<div class="ratings"><div class="ratings-button" style="float: left"><div class="ratings-chart"></div></div></div>');

	if (ratings) {
		var html = '\
				<table><tbody>\
					<tr><td>Communicativity</td><td class="rating">' + bar(attrs.comm) + '</td><td class="light">' + attrs.comm + ' / 5</td></tr>\
					<tr><td>Pay</td>            <td class="rating">' + bar(attrs.pay ) + '</td><td class="light">' + attrs.pay  + ' / 5</td></tr>\
					<tr><td>Fairness</td>       <td class="rating">' + bar(attrs.fair) + '</td><td class="light">' + attrs.fair + ' / 5</td></tr>\
					<tr><td>Quickness</td>      <td class="rating">' + bar(attrs.fast) + '</td><td class="light">' + attrs.fast + ' / 5</td></tr>\
				</tbody></table>';

		var count = ratings.reviews;

		html +=	'<p>Scores based on <a href="http://turkopticon.ucsd.edu/' + requesterID + '" target="_blank">' + count + ' review' + ((count !== 1) ? "s" : "") + '</a>';
		html += ' <span class="light">(' + ratings.tos_flags + ' TOS violation' + ((ratings.tos_flags !== 1) ? "s" : "") + ')</light> - <a href="http://turkopticon.ucsd.edu/report?requester[amzn_id]=' + requesterID + '&requester[amzn_name]=' + ratings.name +'" target="_blank">Add review</a></p>';

		element.find(".ratings-chart").append(html);
		element.find(".ratings-button").css('background-color', getHsl(avg(attrs) / 5 * 100));
	} else {
		var html = '<p>No ratings available.</p>';
		html += '<p>Be the first to <a href="http://turkopticon.ucsd.edu/report?requester[amzn_id]=' + requesterID + '&requester[amzn_name]=' + ratings.name +'" target="_blank">review this requester</a>.';

		element.find(".ratings-chart").append(html);
		element.addClass("no-TO");
	}

	function bar(rating) {
		var percent = rating / 5 * 100,
			color = getHsl(percent);

		return '<div><div style="width: ' + percent + '%; background-color: ' + color + '">&nbsp;</div></div>';
	}

	function getHsl(percent) {
		var hue = ((percent / 100 * 5) - 1) / 4  * 100; // Max hue = 100 (green)
		return 'hsl(' + hue + ', 78%, 50%)';
	}

	function avg(attrs) {
		var count = 0,
			sum   = 0,
			comm  = parseFloat(attrs.comm, 10),
			pay   = parseFloat(attrs.pay, 10),
			fast  = parseFloat(attrs.fast, 10),
			fair  = parseFloat(attrs.fair, 10);

		if (comm !== 0) { sum += comm; count ++; }
		if (pay  !== 0) { sum += pay;  count ++; }
		if (fast !== 0) { sum += fast; count ++; }
		if (fair !== 0) { sum += fair; count ++; }

		return sum / count;
	}
	
	requesterEl.before(element);
}
NotificationGroup.prototype.createDOMElement = function() {
	var _this = this,
		REQUESTER_PREFIX = "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&requesterId=",
		hit = this.hits[0],
		isSameReq = Hit.isSameRequester(this.hits),
		self = this;

	var div = $('<div>').addClass("notification_group")
		.append((this.title !== null) ? $('<h3><a href="' + this.url + '" target="_blank">' + this.title + '</a></h3>') : "")
		.append((isSameReq) ? $('<h4><a href="' + REQUESTER_PREFIX + hit.requesterID + '" target="_blank" class="requester">' + hit.requester + '</a></h4>') : "")
		.hover(
			function() { _this.isHovered = true },
			function() {
				_this.isHovered = false;

				if (_this.hasTimedOut && typeof _this.onTimeout === 'function')
					_this.onTimeout(_this);
			}
		);

	// Sort the notifications (ignored go to the bottom)
	if (pageType.DASHBOARD && pageType.MAIN)
		this.hits.sort(function(a, b) { return (IgnoreList.isIgnored(a.requester)) ? 1 : 0 });
	
	// Add the notifications
	for (var i = 0, len = this.hits.length; i < len; i++) {
		var notification = new NotificationHit(this.hits[i], isSameReq, (typeof this.watcher !== 'undefined') ? this.watcher : null);

		notification.onIgnore = function(requesterID) {
			// Remove all notifications within the group that match the requester ID
			var notifications = self.DOMElement.find(".notification");
			notifications.filter(function() { return $(this).data("requesterID") === requesterID }).addClass("ignored");
		};

		notification.onUnIgnore = function(requesterID) {
			// Remove all notifications within the group that match the requester ID
			var notifications = self.DOMElement.find(".notification");
			notifications.filter(function() { return $(this).data("requesterID") === requesterID }).removeClass("ignored");
		};

		$(div).append(notification.getDOMElement());
	}
	
	if (this.hits[0].isAutoAccept)
		div.addClass("autoaccept");

	this.DOMElement = div;

	// This is required to get the shrinking effect when notifications are removed
	setTimeout(function() { div.css('max-height', div.height()); }, 1000);
}
NotificationGroup.prototype.getDOMElement = function() {
	return this.DOMElement;
}
NotificationGroup.prototype.hasAutoAccept = function() {
	var hasAutoAccept = false;
	for (var i = 0, len = this.hits.length; i < len; i++)
		if (this.hits[i].isAutoAccept) hasAutoAccept = true;
	return hasAutoAccept;
}
NotificationGroup.prototype.fadeOut = function(duration) {
	this.getDOMElement().addClass("removed");
}

/** The Notification object. This holds the notification data for individual hits

**/
function NotificationHit(hit, isSameReq, watcher) {
	this.hit = hit;
	this.isSameReq = isSameReq;
	if (typeof watcher !== 'undefined') this.watcher = watcher;
	
	this.createDOMElement();
}
NotificationHit.prototype.createDOMElement = function() {
	var URL_PREFIX = "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&requesterId=";

	// Create notification
	var hit = this.hit;
	var notification = $('<div>').addClass("notification").append(
		'<a class="title" target="_blank" href="' + hit.getURL('preview') + '" title="' + hit.title + '">' + hit.title + '</a>',
		(!this.isSameReq) ? $('<a class="requester" href="' + URL_PREFIX + hit.requesterID + '" target="_blank">' + hit.requester + '</a> <a class="ignore">ignore</a>') : "",
		'<p>' + hit.reward + " - " + hit.available + " rem. - " + hit.time.replace("minutes", "mins") + '</p>\
		 <div class="links"></div>\
		 <div><a class="mute"></a></div>'
	).data("requesterID", hit.requesterID);

	// Add links
	if (typeof hit.id !== 'undefined' && hit.id !== "undefined" && hit.isQualified) {
		if (this.hit.isAutoAccept) {
			$(".links", notification).append('<a class="hit_link" href="' + hit.getURL('view') + '" target="_blank">VIEW</a>');
		} else {
			$(".links", notification).append('\
				<a class="hit_link" target="_blank" href="' + hit.getURL('preview') + '">PREVIEW</a>\
				<a class="hit_link" target="_blank" href="' + hit.getURL('accept') + '">ACCEPT</a>\
				<a class="hit_link" target="_blank" href="' + hit.getURL('auto') + '">+AUTO</a>');
		}
	} else {
		$(notification).addClass("not_qualified");
		$(".links", notification).append(
			(hit.canPreview) ? '<a class="hit_link" href="' + hit.getURL('preview') + '" target="_blank">PREVIEW</a>' : "",
			'<span class="extra_info">Not Qualified&nbsp;&nbsp;</span>');
	}

	if (IgnoreList.isIgnored(hit.requester))
		notification.addClass("ignored");
	
	
	var id = hit.id;
	var muteButton = $('a.mute', notification);
	
	$(muteButton).text((typeof IgnoreList !== 'undefined' && IgnoreList.isMuted(id)) ? "muted" : "mute");
	$(muteButton).click(function () {
		if (!pageType.DASHBOARD || (pageType.DASHBOARD && !pageType.MAIN)) {
			if ($(this).text() === "mute")
				sendMessage({ header: "mute_hit", content: { id: id }, timestamp: true });
			else
				sendMessage({ header: "unmute_hit", content: { id: id }, timestamp: true });
		} else {
			if (!IgnoreList.isMuted(id))
				IgnoreList.add(IgnoreList.HIT, id);
			else
				IgnoreList.remove(IgnoreList.HIT, id);
		}

		if ($(this).text() === "mute")
			$(this).text("muted");
		else
			$(this).text("mute");
	});

	var ignoreButton = $("a.ignore", notification);

	var self = this;
	ignoreButton.click(function() {
		if (!pageType.DASHBOARD || (pageType.DASHBOARD && !pageType.MAIN)) {
			sendMessage({ header: "ignore_requester", content: { id: hit.requester } });
		} else {
			if (!notification.hasClass("ignored"))
				IgnoreList.add(IgnoreList.REQUESTER, hit.requester);
			else
				IgnoreList.remove(IgnoreList.REQUESTER, hit.requester);
		}

		if (!notification.hasClass("ignored")) {
			if (self.onIgnore && typeof self.onIgnore === 'function')
				self.onIgnore(hit.requesterID);
		} else {
			if (self.onUnIgnore && typeof self.onUnIgnore === 'function')
				self.onUnIgnore(hit.requesterID);
		}
	});

	
	if (hit.isAutoAccept)
		notification.addClass("autoaccept");

	if  (typeof this.watcher !== 'undefined' && this.watcher !== null && this.watcher.isNewHit(hit))
		$(notification).addClass("new");

	$(notification).append(muteButton);
	
	this.DOMElement = notification;
}
NotificationHit.prototype.getDOMElement = function() {
	return this.DOMElement;
}

var Sound = function() {
	var sound = new Audio(),
		altSound = new Audio();
	
	if (sound.canPlayType('audio/ogg;codecs="vorbis"')) {
		sound.src = "http://rpg.hamsterrepublic.com/wiki-images/3/3e/Heal8-Bit.ogg";
		sound.volume = settings.volume / 100;
	}

	if (altSound.canPlayType('audio/mp3')) {
		// Sound from http://www.freesfx.co.uk (Multimedia System Alert 003)
		altSound.src = "data:audio/mp3;base64," + "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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuOf/7WGT/j/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABDdVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuOf/7WGT/j/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABDdVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7WGT/j/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";
		altSound.volume = settings.volume / 100;
	}

	function _alert(context) {
		if (settings.sound) {
			if (context instanceof Watcher) {	// It's written this way in case we want sounds for other things in the future
				var option = context.option;
				if (!option.stopOnCatch && option.auto) {
					altSound.currentTime = 0;
					altSound.play();
				} else if (option.auto || option.alert) {
					sound.currentTime = 0;
					sound.play();
				}
			}
		}
	}

	function _setVolume(volume) {
		sound.volume = altSound.volume = volume / 100;
	}

	return {
		alert     : _alert,
		setVolume : _setVolume
	}
}();