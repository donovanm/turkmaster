// ==UserScript==
// @name        Turkmaster
// @namespace   https://greasyfork.org/users/3408
// @description A web app to make turking a little easier
// @include     https://www.mturk.com/mturk/*
// @version     0.96
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js
// @require 	https://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js
// @grant       none
// ==/UserScript==

var settings = {
	sound         : true,
	animation     : true,
	preloadHits   : false,
	volume        : 30,
	notifications : true,
	alertOnly     : false,
	fontSize      : 10,
	typeface      : "Oxygen",
	desktopNotifications : false,
	setfontSize   : function(val) {
		settings.fontSize = val;
		$("#dispatcher div").css("font-size", val + "pt");
		$(".notification_panel p").css("font-size", val + "pt");
		$("#settingsDialog div").css("font-size", val + "pt");
	},
	setDesktopNotifications : function(val, callback) {
		if (val) {
			requestWebNotifications(function(isPermitted) {
				callback(isPermitted);
				settings.desktopNotifications = isPermitted;
			});
		} else {
			settings.desktopNotifications = false;
		}
	}
};

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

		if (settings.preloadHits)
			loadHits();
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
		dispatch.ignoreList.save();
		// dispatch.save();
	}
});

function loadFonts() {
	WebFont.load({
		google: { families: [ 'Oxygen:400,700:latin' ] }
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
		DOMElement.find("#fontSize input").val(settings.fontSize);
		DOMElement.find("#typeface input").val(settings.typeface);
	}

	function _save() {

	}

	function _cancel() {
		DOMElement.hide();
		console.log("Cancelled");
	}

	function _createDOMElement() {
		console.log("Creating DOM Element");
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
			   </div>')
		)

		_addHandlers();

		$("body").append(DOMElement);
	}

	function _addHandlers() {
		DOMElement.on('click', function(e) {
			if (e.target.tagName === "BUTTON")
				_handleButtonToggle(e);
		});

		DOMElement.on('change', _handleInputChange);
	}

	function _handleWindowClick(e) {
		console.log(e.target);
		console.log($("#settings").get(0));
		if (!DOMElement.is(e.target) && DOMElement.has(e.target).length === 0 && $("#settings img").get(0) !== e.target) {
			_cancel();
			// $(window).off(_handleWindowClick);
		}
	}

	function _handleInputChange(e) {
		console.log("Handling input change");
		var target = $(e.target),
			value = target.val(),
			id = target.parent().attr('id');

		if (id === "volume")
			settings.volume = value;
		else if (id === "fontSize")
			settings.setfontSize(value);
		else if (id === "typeface")
			settings.typeface = value;

		console.dir(settings);
	}

	function _handleButtonToggle(e) {
		e.preventDefault();
		var target = $(e.target),
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
				console.log("Ispermitted", isPermitted);
				if (isPermitted) {
					target.addClass("on");
				} else {
					target.removeClass("on");
					console.log("Desktop notifications are blocked.");
				}
			});
		} else if (id === "alertOnly") {
			settings.alertOnly = value;
		}
	}

	function _addStyle() {
		addStyle("\
			#settingsDialog {\
				position: absolute;\
				top: 9px;\
				left: 26px;\
				background-color: #fafafa;\
				padding: 10px;\
				width: 300px;\
				font: 10pt 'Oxygen',verdana, sans-serif;\
				border-bottom: 1px solid #DDD;\
				border-right: 1px solid #DDD;\
				border-radius: 0.3em;\
			}\
			#settingsDialog div, #settingsDialog li, #settingsDialog input, #settingsDialog button {\
				font: 10pt 'Oxygen',verdana, sans-serif;\
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
			}\
			#settingsDialog .on_off span { color: #333; margin: 1px; font-size: 56%; font-weight: bold; border-radius: 1.6em;  }\
			#settingsDialog .on_off span:nth-child(2) { background-color: #aeaeae; color: #fff; padding: 0.4em 0.8em; }\
			#settingsDialog .on_off.on span:nth-child(1) { background-color: #55b8ea; color: #fff; padding: 0.4em 0.8em; }\
			#settingsDialog .on_off.on span:nth-child(2) { background-color: inherit; color: #333; padding: 0 0.8em 0 0; }\
			#settingsDialog .on_off { margin-top: 6px; }\
			#settingsDialog ul { margin: 0 0 0.2em; padding: 0 0 0 1.9em }\
			#settingsDialog ul li { list-style: none; margin-bottom: 0.5em; }\
			#settingsDialog li input { float: right; width: 3em; font-size: 80%; margin-right: 0.8em; text-align: right; padding-right: 0.5em }\
			#settingsDialog li#typeface input { width: 8em }\
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

				console.log("Watcher", watcher);

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
			font-family: 'Oxygen';\
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

function loadHits() {
	// Add a few watchers. Won't be done like this in the future
	dispatch.isLoading = true;
	dispatch.add(new Watcher({
		id: "A2SUM2D7EOAK1T",
		time: 120000,
		type: 'requester',
		name: 'Crowdsource'}));
	dispatch.add(new Watcher({
		id: "AX7NXUM5E66CV",
		time: 120000,
		type: 'requester',
		name: 'Global Media'}));
	dispatch.add(new Watcher({
		id: "A11L036EBWKONR",
		time: 14000,
		type: 'requester',
		name: "Project Endor*",
		option: {alert:true}}));	// Endor
	dispatch.add(new Watcher({
		id: "A2ELUBUNBP6BLE",
		time: 60000,
		type: 'requester',
		name: "UW Social Media Lab*",
		option: {alert:true}}));	// UW Social Media Lab
	dispatch.add(new Watcher({
		id: "A35GBZ8TKR3UKC",
		time: 20000,
		type: 'requester',
		name: "Andy K*",
		option: {alert:true}}));	// Andy K
	dispatch.add(new Watcher({
		id: "A2BAP2QO7MMQI9",
		time: 60000,
		type: 'requester',
		name: "Product RnR*",
		option: {alert:true}}));	// RnR
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=survey&minReward=0.75&qualifiedFor=on&x=13&y=10",
		time: 25000,
		type: 'url',
		name: "Surveys $0.75 and up"})); //$.75 surveys
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=survey&minReward=0.25&qualifiedFor=on&x=13&y=10",
		time: 30000,
		type: 'url',
		name: "Surveys $0.25 and up"})); //$.25 surveys
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=qualification&minReward=0.00&x=0&y=0",
		time: 300000,
		type: 'url',
		name: "Qualification HITs"})); // Qualification HITs
	dispatch.add(new Watcher({
		id: "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=transcribe&minReward=0.60&qualifiedFor=on&x=0&y=0",
		time: 60000,
		type: 'url',
		name: "Transcription HITs"})); // Transcription HITs
	dispatch.add(new Watcher({
		id: "A2S0QCZG8DTNJC",
		time: 20000,
		type: 'requester',
		name: "Procore Development*",
		option: {alert:true}}));	// Procore Development
	dispatch.add(new Watcher({
		id: "AO1GS3CMM2IGY",
		time: 180000,
		type: 'requester',
		name: "Five Star"})); // Five Star
	dispatch.add(new Watcher({
		id: "ALZUWU3P4QQSG",
		time: 45000,
		type: 'requester',
		name: "Nate Ricklin"})); // Nate!
	dispatch.add(new Watcher({
		id: "A1HTPXGAZGXM4J",
		time: 45000,
		type: 'requester',
		name: "AJ Ghergich (like AndyK)"})); // Find the email
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
			case 'mute_hit' :
				var id = message.split(',')[0];
				if (!dispatch.isMuted(id)) {
					dispatch.mute(id);
					console.log("Remote mute (" + id + ")");
				} 
				break;
			case 'unmute_hit' :
				var id = message.split(',')[0];
				if (dispatch.isMuted(id)) {
					dispatch.unmute(id);
					console.log("Remote unmute (" + id + ")");
				}
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
				notificationPanel.add(new NotificationGroup(message.title, hits));
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

function sendBrowserNotification(hits, watcher) {
	// Let's check if the browser supports notifications
    if (!("Notification" in window)) {
		console.log("This browser does not support desktop notification");
    }

	// Let's check if the user is okay to get some notification
	else if (Notification.permission === "granted" && settings.desktopNotifications) {
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

function requestWebNotifications(callback) {
	window.Notification.requestPermission(function (permission) {
		// Whatever the user answers, we make sure Chrome stores the information
		if(!('permission' in Notification))
			window.Notification.permission = permission;

		// If the user is okay, let's create a notification
		if (permission === "granted") {
			new window.Notification("Notifications enabled.");
			callback(true);
		} else {
			callback(false);
		}
	});
}



// This is the Hit object
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
		position: absolute; top: 0px;\
		margin-left: 1px;\
		width: 500;\
		border: 1px solid #e3e3e3;\
		border-radius: 0 0 3px 0;\
		border-width: 0 1px 1px 0;\
		display: none }\
	#details_panel h4 { display: none }");
	
	$(div).mouseleave(function() { $(this).hide() });
	$(div).css('left', $("#dispatcher").css('width'));
		
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
			group = new NotificationGroup(null, watcher.lastHits, false, watcher);
			$(panel).append((group).getDOMElement());

			// This shouldn't need to use callback once caching is enabled. Anything TO info in the
			// details panel will have been already retrieved from the server.
			TO.get(Hit.getUniqueReqeusters(watcher.lastHits), _handleTOReceived);
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


function IgnoreList() {
	this.time = 60000;
	this.items = new Array();
	this.load();

	var _this = this;
	this.interval = setInterval(function() { _this.save() }, this.time);
}
IgnoreList.prototype.save = function() {
	localStorage.setItem('notifier_ignore', JSON.stringify(this.items));
}
IgnoreList.prototype.load = function() {
	var storedItems = localStorage.getItem('notifier_ignore');

	if (storedItems !== null) {
		try {
			this.items = JSON.parse(storedItems);
			console.log(this.items.length + " ignored items loaded");
		}
		catch (e) {
			this.clear();
			this.save();
			console.log("Ignore list couldn't be loaded correctly. It has been cleared out.");
		}
	} else {
		console.log("No ignored items found");
	}
	var _this = this;
	setInterval(function(){ _this.save() }, this.time);
}
IgnoreList.prototype.clear = function() {
	this.items = new Array();
	localStorage.removeItem('notifier_ignore');
}
IgnoreList.prototype.stop = function() {
	clearInterval(this.interval);
}
IgnoreList.prototype.contains = function(item) {
	return (this.items.indexOf(item) !== -1);
}
IgnoreList.prototype.add = function(item) {
	if (!this.contains(item))
		this.items.push(item);
}
IgnoreList.prototype.remove = function(item) {
	var index = this.items.indexOf(item);

	if (index !== -1)
		this.items.splice(index, 1);
}



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

		var ctrl = $("#controller", div);
		var settingsBtn = ctrl.append($("<a>")
				.attr('id', "settings")
				.attr('href', "javascript:void(0)")
				.attr('title', "Settings")
				.html('<img />')
				.click(function() {
					if (!SettingsDialog.isVisible())
						SettingsDialog.show();
					else
						SettingsDialog.hide();
				})
			)
			.append("Mturk Notifier")
			.append('<div class="on_off"><a>ON</a><a>OFF</a></div>');

		// Adding the data URL inline wouldn't work for some reason, so I'm doing it this way.
		// Image from http://latierrasenosestrecha.org/wp-content/themes/purity/img/icons/settings.png
		$("img", settingsBtn)[0].src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2RpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpFRUQ3N0Q2NkUyQjJFMDExOTM4OUZBRkY5RUM4NjkxMiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFQjNFQjA2OEIyRTYxMUUwOUZDRUUxRERBNzIzQkY1NyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFQjNFQjA2N0IyRTYxMUUwOUZDRUUxRERBNzIzQkY1NyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3MiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpFRkQ3N0Q2NkUyQjJFMDExOTM4OUZBRkY5RUM4NjkxMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpFRUQ3N0Q2NkUyQjJFMDExOTM4OUZBRkY5RUM4NjkxMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PiP+YRgAAALDSURBVHja7FdPZB1BGJ9tawmt8HinrUQpjdBqqFaq5BChJBI5xCvVQ1mPRq89hGqkeusxpLpKDtFTqpEorUZKKdFcWo2WR7REwyOE8niUeP19/Jbxmd3NbjXv0Aw/szO733z/ft/MrNdqtUw72zHT5tZ2A04UEYqiaBTdPFAC9oDb1Wp15TAjMEflhv3cP4kAPC2j6wK24OEv61WgPg2U3El054BtyO2m6fCSqgCLDKBbBjqBHWAQ+A3cAmYcItPAAp/XgDOAGD0GI97nMgDKRel3K8yGuRbP/BSHxMCGkhMjemBEPQ8HetUica79jJT6Djlx5nxeEn4GagnvNiSswCl45UnP8UbC99vAehEOSA4/AmUrvPeBF8A9YJgEFQVvgMdABXhgRUoIeBWGbhUtw07rOWRkvgB3qNywrwKfGIVJJb9fdB+oWJ6Ih8LkRRLR1WT+JfAO+GBxonLgMkTYx9E9cxBpBLgO3OW4xt1vHTJDlIkj8oQGPFdrSBWFkFlKi8CsQ7khicat8YQolwf0qyrso4yWcVTRbFYKAofgPpTsWWRsYrzJiL2yKiNuZZLP1YIsA1ybxXEoKlmLdmB8kd6PcK7f+n7XMtZkra/PgpAHS5eaFwUrZL+0RRgRMtfD6jASwg4k7AeTefaBGda0NMnzTeBrincx0XpYDdc49xCRmi5ShpHkm89D9PRGSn5lfoJkjZU3uU6hfcDnwRK3p0zFBS5at/Iacb5fMb2Rsm8kG4Dwd6B7q8ItBj3iES0p6eNZ0Mfxa773VUWs8XTNdSERlp9NeHeZO6IYepBLT0CZ1Twp+EZCaYI1M5Q1HXJyH9jMlQJev8YoLO0HcAXoBqYS1pri+0v83lg3onru45ghLvFqVcMiDWu+5TDaUxzq/as7YcZl9afaVneg6PRhXstDVYZh0Wu5d/Rv+N8b8EeAAQBg+uBx8hdn9gAAAABJRU5ErkJggg==";

		if (DispatchUI.dispatch.isRunning)
			$(".on_off", ctrl).addClass("on");
	},

	addActions: function() {
		var dispatch = DispatchUI.dispatch;
		$("#controller .on_off", DispatchUI.div).mousedown(function() {
			if (!dispatch.isRunning) {
				dispatch.start();
			} else {
				dispatch.stop();
			}
		});
	},

	addListeners: function() {
		var dispatch = DispatchUI.dispatch;
		dispatch.addListener(Evt.START, function() {
			$(".on_off", ctrl).addClass("on");
		});

		dispatch.addListener(Evt.STOP, function() {
			$(".on_off", ctrl).removeClass("on");
		});

		dispatch.addListener(Evt.ADD, function(watcher) {
			// This could be done on one line, but then we would lose access to the WatcherUI's internal Watcher object and functionality
			var watcherEl = WatcherUI.create(watcher);
			$("#watcher_container", DispatchUI.div).append(watcherEl);
			DispatchUI.watchers.push(watcherEl);
			// watchers.push(WatcherUI.create(watcher).appendTo($("#watcher_container", div)));
		});

		dispatch.addListener(Evt.REMOVE, function(watcher) {
			// Nothing to do
		});
	},

	addStyle: function() {
		addStyle("#dispatcher { background-color: #f5f5f5; position: fixed; top: 0px; float: left; height: 100%;  width: 270px; font-size: 8pt;  margin-left: 0px; margin }\
			#content_container { position: absolute; left: 270px; top: 0; right: 0; border-left: 2px solid #dadada; }\
			#dispatcher #controller { text-align: center; font: 160% Candara; color: #585858; position: relative; }\
			#dispatcher #controller .on_off { margin: 6px 5px 0 0 }\
			#dispatcher #controller .on_off a { font-size: 80% }\
			#dispatcher #controller #settings { top: -3px; position: relative; float: left; margin: 3px 2px}\
			#dispatcher #controller #settings img { width: 1.5em }\
			#dispatcher #watcher_container { position: absolute; top: 27px; bottom: 0; overflow-y:auto; width: 100%;}\
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
				cursor: default;\
				transition: background-color 0.5s;\
				-moz-user-select: none;\
				-webkit-touch-callout: none;\
				-webkit-user-select: none;\
				-khtml-user-select: none;\
			}\
			#dispatcher .watcher:first-child { margin-top: 0px }\
			#dispatcher .watcher div { font: 10pt 'Oxygen', sans-serif }\
			#dispatcher .watcher.running .details { background-color: #C3ECFC; background-color: rgba(218, 240, 251, 1); }\
			#dispatcher .watcher.updated { background-color: #e8f5fc; background-color: rgba(218, 240, 251, 1) }\
			#dispatcher .watcher .details { width: 25px; text-align: center; float: right; background-color: rgba(234, 234, 234, 1); position: absolute; top: 0; bottom: 0; right: 0; font-size: 90%; color: #fff; transition: background-color 0.5s }\
			#dispatcher .watcher .details.updated { background-color: rgba(218, 240, 251, 1); background-color: #e8f5fc; background-color: rgba(220, 255, 228, 1) }\
			#dispatcher .watcher .name { font-size 130%; color: black; text-decoration: none; display: inline-block; margin-top: -3px}\
			#dispatcher .watcher .name:hover { text-decoration: underline }\
			#dispatcher .watcher .name.no_hover:hover { text-decoration: none }\
			#dispatcher .watcher .time { display: block; float: left; font-size: 80% }\
			.on_off { float: right; cursor: pointer }\
			.on_off a { color: #333; margin: 1px; font-size: 56%; font-weight: bold }\
			.on_off a:nth-child(2) { background-color: #aeaeae; color: #fff; border-radius: 12px; padding: 3px 6px; }\
			.on_off.on a:nth-child(1) { background-color: #55b8ea; color: #fff; border-radius: 12px; padding: 3px 6px; }\
			.on_off.on a:nth-child(2) { background-color: inherit; color: #333; border-radius: inherit; padding: inherit; }\
			#dispatcher .watcher div:nth-child(2) { margin-right: 25px; padding: 5px 5px 5px 10px;}\
			#dispatcher .watcher .bottom { margin: 0 0 -5px; color: #aaa }\
			#dispatcher .watcher .bottom a:link { color: black; }\
			#dispatcher .watcher .bottom a:hover { color: #cef; }\
			#dispatcher .watcher .details { font-size: 150%; font-weight: bold }\
			#dispatcher .watcher .last_updated { position: absolute; right: 30px; bottom: 4px; font-size: 80% }\
			#dispatcher .watcher .icons { visibility: hidden; margin-left: 10px; bottom: 5px }\
			#dispatcher .watcher:hover .icons { visibility: visible }\
			#dispatcher .watcher .icons img { opacity: 0.2; height: 0.9em }\
			#dispatcher .watcher .icons img:hover { opacity: 1 }\
			#dispatcher .watcher .color_code { position: absolute; left: 0; top: 0; bottom: 0; width: 9px; cursor: row-resize }\
			#dispatcher .watcher .color_code div { position: absolute; left: 0; top: 0; bottom: 0; width: 5px; transition: width 0.15s }\
			#dispatcher .watcher .color_code:hover div { width: 9px }\
			#dispatcher .watcher .color_code.hit div       { background-color: rgba(234, 111, 111, .7); }\
			#dispatcher .watcher .color_code.requester div { background-color: rgba(51, 147, 255, .7); }\
			#dispatcher .watcher .color_code.url div       { background-color: rgba(57, 221, 122, .7); }");
	},

	addDragAndDrop: function() {
		// Drag watchers
		var startY, currentBaseY, limit, height,
			dragDiv, nextDiv, prevDiv, startPos, endPos, isDragging,
			slop = 7, watchers = DispatchUI.watchers;

		DispatchUI.div.on("mousedown", ".watcher", function(e) {
			isDragging = false;

			// Get the position of the watcher in the listing
			startPos = endPos = $("#watcher_container .watcher").index(e.currentTarget);

			// Get reference to the selected watcher
			dragDiv = watchers[startPos].addClass("dragging");
			nextDiv = dragDiv.next();
			prevDiv = dragDiv.prev();

			// TODO Check target to prevent dragging from a component inside the watcher (i.e. buttons, links, etc.)
			height = dragDiv.outerHeight(true);

			currentBaseY = startY = e.clientY;
			limit = Math.min($("#watcher_container").outerHeight(true), height * (DispatchUI.dispatch.watchers.length + .75)) - height;
			
			$(window).on("mousemove", move);
			$(window).on("mouseup", up);
		});

		function move(e) {
			var offsetY = e.clientY - startY;
			var diffY = e.clientY - currentBaseY;

			if (!isDragging && (Math.abs(offsetY) > slop)) {
				// Start dragging
				isDragging = true;

				dragDiv.css('cursor', "row-resize");
				dragDiv.css('z-index', "100");
				dragDiv.css('opacity', "0.9");
				$(".name", dragDiv).addClass("no_hover");
			}

			if (isDragging) {
				if (diffY > height / 2) {
					// Move down one spot
					nextDiv.css('top', parseInt(nextDiv.css('top')) - height);
					nextDiv = nextDiv.nextAll(":not(.dragging)").first();
					prevDiv = prevDiv.nextAll(":not(.dragging)").first();

					currentBaseY += height;
					endPos++;
				} else if (-diffY > height / 2) {
					// Move up one spot
					prevDiv.css('top', parseInt(prevDiv.css('top')) + height);
					prevDiv = prevDiv.prevAll(":not(.dragging)").first();
					nextDiv = nextDiv.prevAll(":not(.dragging)").first();

					currentBaseY -= height;
					endPos--;
				}

				dragDiv.css('top', offsetY);
			}
		}

		function up(e) {
			$(window).off("mousemove", move);
			$(window).off("mouseup", up);

			if (isDragging) {
				e.preventDefault();
				isDragging = false;

				// $("div", colorCode).css('width', '');
				dragDiv.css('cursor', '');
				dragDiv.css('z-index', '');
				dragDiv.css('opacity', '');
				$(".name", dragDiv).removeClass("no_hover");
				dragDiv.removeClass("dragging");

				// Reset all watcher offsets
				$("#watcher_container .watcher").css('top', '');

				if (startPos !== endPos) {
					if (endPos > startPos)
						dragDiv.insertAfter($("#watcher_container .watcher")[endPos]);
					else
						dragDiv.insertBefore($("#watcher_container .watcher")[endPos]);

					DispatchUI.dispatch.moveWatcher(startPos, endPos);

					// Re-arrange our watchers array
					watchers.splice(startPos, 1);
					watchers.splice(endPos, 0, dragDiv);
				}
			}
		}
	}
}

/** Dispatch object. Controls all of the watchers.

**/
function Dispatch() {
	this.isRunning = false;
	this.watchers = new Array();
	this.ignoreList = new IgnoreList();
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
Dispatch.prototype.start = function() {
	if (this.watchers.length > 0) {
		var count = 0;
		for (var i = 0, len = this.watchers.length; i < len; i++) {
			// Don't start them all at the same time. There is a 2 second delay
			// between each start. It had to be done in a self-executing function
			// in order for the setTimeout to work properly.
			if (this.watchers[i].state.isOn) {
				(function (watcher, x){
						watcher.timer = setTimeout(function() { watcher.start(); }, x * 0000); // Let's try 0ms
				})(this.watchers[i], count++);
			}
		}
	}
	this.isRunning = true;
	this.notify(Evt.START, null);
}
Dispatch.prototype.stop = function() {
	// Stop all Watchers
	if (this.watchers.length > 0) {
		for (var i = 0, len = this.watchers.length; i < len; i++)
			this.watchers[i].stop();
	}
	this.isRunning = false;
	this.interruptStart = true;
	this.notify(Evt.STOP, null)
}
Dispatch.prototype.add = function(watcher) {
	this.watchers.push(watcher);

	if (!this.isLoading) {
		this.save();
	}

	this.notify(Evt.ADD, watcher);

	// TODO Add a listener to save the watcher list after a watcher has been changed
	// var _this = this;
	// watcher.addListener(Watcher.CHANGE, _this.saveFake());
	return watcher;
}
Dispatch.prototype.saveFake = function () {
	console.log("Saving watcher list after a watcher has been changed.");
}
Dispatch.prototype.save = function() {
    if (!loadError) {
        console.log("Saving " + this.watchers.length + " watchers...");
        localStorage.setItem('notifier_watchers', JSON.stringify(dispatch.watchers,Watcher.replacerArray));
		// localStorage.setItem('notifier_watchers_backup', JSON.stringify(dispatch.watchers,Watcher.replacerArray));
    }
}
Dispatch.prototype.load = function() {
	this.isLoading = true;
	var data = localStorage.getItem('notifier_watchers');
	var watchers;

	if (data !== null) {
		watchers = JSON.parse(data);
		try {
			for(var i = 0; i < watchers.length; i++) this.add(new Watcher(watchers[i]));
		} catch(e) {
			loadError = true;
			console.log("Error loading saved list", e);
        }
	} else {
		loadHits();
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
Dispatch.prototype.getWatcherById = function(id) {
	if (this.watchers.length > 0) {
		for (var i = 0, len = this.watchers.length; i < len; i++) {
			if (this.watchers[i].id === id)
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
Dispatch.prototype.isMuted = function(hitID) {
	return this.ignoreList.contains(hitID);
}
Dispatch.prototype.mute = function(hitID) {
	this.ignoreList.add(hitID);
}
Dispatch.prototype.unmute = function(hitID) {
	this.ignoreList.remove(hitID);
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
	this.ignoreList.stop();
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
		// dialog.hide();
		// dialog.remove();
		dialog.empty();
		dialog = null;
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
		<div>\
			<div class="on_off"><a>ON</a><a>OFF</a></div>\
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

	if (watcher.state.isOn) $(".on_off", div).addClass("on");

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
		$(".name", div).text(watcher.name);
		$(".time", div).text(watcher.time / 1000 + " seconds");

		if (watcher.state.isOn)
			$(".on_off", div).addClass("on");
		else
			$(".on_off", div).removeClass("on");
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
	$(".edit", div).click(function() {
		watcherDialog(watcher, function(values) {
			watcher.setValues({
				name        : values.name,
				time        : values.time,
				alert       : values.alert,
				stopOnCatch : values.stopOnCatch
			})

			// Uses setAuto so its internal hits will also be marked as auto
			watcher.setAuto(values.auto);
		});
	});

	$(".delete", div).click(function() {
		dispatch.remove(watcher);
	});

	$(".details", div).mouseover(function () {
		showDetailsPanel(watcher);
		$(this).removeClass("updated");
	});

	$(".on_off", div).mousedown(function() {
		watcher.toggleOnOff();
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

	return div;
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
	this.lastHits    = new Array();
	this.newHits     = new Array();

	attrs = attrs || {};
	
	// Default states
	this.state = {};
	state = attrs.state || {};
	this.state.isRunning = (typeof state.isRunning !== 'undefined') ? state.isRunning : false;
	this.state.isOn      = (typeof state.isOn !== 'undefined') ? state.isOn : true;
	this.state.isUpdated = (typeof state.isUpdated !== 'undefined') ? state.isUpdated : false;

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
	
	// Options
	this.option = {};
	option 	= attrs.option || {};
	this.option.auto        = (typeof option.auto !== 'undefined') ? option.auto : false;
	this.option.alert       = (typeof option.alert !== 'undefined') ? option.alert : false;
	this.option.stopOnCatch = (typeof option.stopOnCatch !== 'undefined') ? option.stopOnCatch : true;
	// console.log(JSON.stringify(option,null,4));
	// Figure out the URL
	this.url = attrs.url;
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
	if (typeof this.url === 'undefined') {
		switch(this.type) {
			case 'hit':
				this.url = "https://www.mturk.com/mturk/preview" + (this.option.auto ? "andaccept" : "") + "?groupId=" + this.id;
				break;
			case 'requester':
				this.url = "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&requesterId=" + this.id;
				break;
			case 'url':
				this.url = this.id;
				
				// URL watchers get a random id because of id requirements for CSS
				this.id = "A" + Math.floor(Math.random() * 100000000);
				break;
		}
	}
}
Watcher.prototype.setAuto = function(isAuto) {
	this.option.auto = isAuto;
	this.setUrl();
}
Watcher.prototype.isNewHit = function (hit) {
	return (this.newHits.indexOf(hit) !== -1);
}
Watcher.prototype.onChanged = function() {
	this.isUpdated = true;
	this.notify(Evt.HITS_CHANGE, null);
	
	// Sound alert for auto-accept HIT watchers and watchers that have the alert set on
	if (this.option.auto || this.option.alert)
		this.alert();
}
Watcher.prototype.start = function() {
	var _this = this;
	
	// Set the interval and start right away
	this.interval = setInterval(function(){ _this.getData() }, this.time);
	this.getData();
	
	this.state.isRunning = true;

	this.notify(Evt.START, null);
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
	var filteredHits = new Array();

	if (typeof this.lastHits !== 'undefined' && this.lastHits.length > 0) {
		this.isChanged = false;
		
		for (var i = 0, len = newHits.length; i < len; i++) {
			// Check if the hit is on the ignore list first before wasting time going through the comparisons
			if (!dispatch.isMuted(newHits[i].id)) {
				// Compare URLs for now. Should just use IDs in the future
				for (var j = 0, len2 = this.lastHits.length; j < len2; j++) {
					if (newHits[i].url === this.lastHits[j].url) {
						break;
					}
					
					// If we reach the end with no matches, add it to the changed hits array
					if (j === len2 - 1 ) {
						filteredHits.push(newHits[i]);
						this.isChanged = true;
					}
				}
			}
		}

		if (this.isChanged)
			this.onChanged();

		if (this.option.auto && !this.option.stopOnCatch)
			this.onChanged(); // Might add a different method for this case, but using onChanged for now

		this.lastHits = newHits;
		this.newHits  = filteredHits;

		return filteredHits;
	}
	
	// If "last hits" doesn't exist, then all of the new hits should be considered new
	// console.log("Returning same hits");
	for (var i = 0, len = newHits.length; i < len; i++)
		if (!dispatch.isMuted(newHits[i].id))
			filteredHits.push(newHits[i]);
	
	this.onChanged();
	this.lastHits = newHits;
	return filteredHits;
}
Watcher.prototype.toggleOnOff = function() {
	if (this.state.isOn) {
		this.stop();
		this.state.isOn = false;
	} else {
		if (!this.state.isRunning)
			this.start();
		this.state.isOn = true;
	}

	this.notify(Evt.CHANGE, null);
}
Watcher.prototype.markViewed = function () {
	if (this.isUpdated) {
		isUpdated = false;
		this.notify(Evt.VIEW_DETAILS, null);
	}
}
Watcher.prototype.alert = function () {
	var sound = new Audio();
	
	if (sound.canPlayType('audio/ogg;codecs="vorbis"') && settings.sound) {
		sound.src = "http://rpg.hamsterrepublic.com/wiki-images/3/3e/Heal8-Bit.ogg";
		sound.volume = settings.volume / 100;
		sound.play();
	}
}
Watcher.prototype.updateWatcherPanel = function() {
	this.date = new Date();
	this.notify(Evt.UPDATE, null);
}
Watcher.prototype.setValues = function(values) {
	// console.log("Before updating watcher", this);

	// console.log("Time entered", values.time);

	var val = values || {};
	this.name = val.name || this.name;
	this.option.auto = val.auto;
	this.option.stopOnCatch = val.stopOnCatch;
	this.option.alert = val.alert;

	if (typeof val.time !== 'undefined' && this.time !== val.time) {
		this.time = val.time;
		// console.log("this.state.isRunning", this.state.isRunning);
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
		hits = this.filterMessages(hits);

		// console.log(JSON.stringify(hits,null,4));
		if (hits.length > 0) {
			Messenger.sendHits(this, hits);
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
		// console.log("No more available.");
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
			this.toggleOnOff();
		
		return new Array(hit);
	}
}
Watcher.replacerArray = ["id", "time", "type", "name", "option", "auto", "alert", "stopOnCatch", "state", "isRunning", "isOn", "isUpdated", "url"];

var Messenger = function() {
	var SEND_HITS = "new_hits";
	var SEND_TO = "turkopticon";
	var notificationGroup;

	function _sendHits(watcher, hits) {
		// Pass through ignore filters

		// Set wasViewed to false to check if any receiving windows were focused when this
		// was sent.
		wasViewed = false;

		// Send Hits
		sendMessage({ header: SEND_HITS, content: {'title':watcher.name, 'hits':hits} });

		// Get TO and send it
		var toData = TO.get(Hit.getUniqueReqeusters(hits), _handleTOReceived);
		sendMessage({ header: SEND_TO, content: toData });

		// Show notification on dashboard, too
		notificationGroup = notificationPanel.add(new NotificationGroup(watcher.name, hits));

		// Attempt to send a browser notification after a brief period of time. If another mturk
		// page was visible when it received the hits, this will cancel out.
		if (!document.hasFocus()) {
			// var _this = this;
			setTimeout(function() { sendBrowserNotification(hits, watcher); }, 200);
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
		intervalTime = 100,	// The amount of time between page loads
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
	var URL_PREFIX = "https://api.turkopticon.istrack.in/multi-attrs.php?ids=";

	function _get(ids, callback) {
		var data = _getFromStorage(ids);

		// If not all requesters found in storage, fetch from server
		// if (data.length < ids.length)
			_fetchFromServer(URL_PREFIX + ids.join(','), callback);

		return data;
	}

	function _getFromStorage(ids) {
		// Fake it for now
		return '{"A2S0QCZG8DTNJC":{"name":"Procore Development","attrs":{"comm":"5.00","pay":"4.87","fair":"5.00","fast":"5.00"},"reviews":15,"tos_flags":0},"A6YG5FKV2TAVC":{"name":"Agent Agent","attrs":{"comm":"4.33","pay":"4.78","fair":"4.80","fast":"4.57"},"reviews":84,"tos_flags":0}}';
	}

	function _fetchFromServer(url, callback) {
		$.get(url, function(data) {
			callback(data);
		})
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
	if (this.notifications.length > 0 && this.notifications[0].hasTimedOut) {
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
	var panel =	$("<div>")
			.addClass("notification_panel")
			.addClass("hidden")
			.attr('id', "receiver")
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
		.notification_panel div, .notification_panel p { font: 10pt 'Oxygen', sans-serif; }\
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
			display     : block;\
			margin-top  : 2px;\
			color       : black;\
			font-size   : 80%;\
			font-weight : bold;\
		}\
		.notification .extra_info {\
			font-style : italic;\
			font-size  : 80%;\
			color      : #505050;\
			cursor     : default;\
		}\
		.notification_panel a:link, .notification_panel a:visited {\
			font-size       : 130%;\
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
			background-color: #def;\
			border-radius: 3px;\
			font-size: 80%;\
			position: relative;\
			top: 0.5em;\
		}\
		.notification_panel .ratings-button > .ratings-chart {\
			position: absolute;\
			bottom: 0;\
			left: 0.4em;\
			background-color: rgb(255, 255, 255);\
			visibility: hidden;\
			padding: 0.3em;\
			border: 1px solid #f0f0f0;\
		}\
		.notification_panel .ratings-button:hover > .ratings-chart {\
			visibility: visible;\
		}\
		.notification_panel .ratings-chart table { border-collapse: collapse; }\
		.notification_panel .ratings-chart td {	font-size: 70%;	padding: 0 2em 0 0; }\
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
function NotificationGroup(title, hits, isSticky, watcher) {
	this.title       = title;
	this.hits        = hits;
	this.isSticky    = (typeof isSticky !== 'undefined') ? isSticky : this.hasAutoAccept();
	this.timeout     = (this.isSticky) ? 15000 : 6000;
	this.hasTimedOut = false;
	this.isHovered   = false;

	if (typeof watcher !== 'undefined') this.watcher = watcher;
	
	var _this = this;
	setTimeout(function() {
		if (typeof _this.onTimeout !== 'undefined' && _this.onTimeout !== null) {
			_this.hasTimedOut = true;

			 if (!_this.isHovered)
				_this.onTimeout(_this);
		}
	}, this.timeout);

	this.createDOMElement();
}
NotificationGroup.prototype.addTO = function(data) {
	var ratings = JSON.parse(data);
	var group = this.getDOMElement();

	console.log(".addTO ratings", ratings);

	var notifications = group.find(".notification");

	for (id in ratings) {
		// console.log(id);
		
		currentNotification = notifications.filter(function() { return $(this).data("requesterID") === id });
		// console.log(currentNotification);

		// console.log({ id: id, ratings: ratings[id] });
		this.appendRatings({ notification: currentNotification, id: id, ratings: ratings[id] });
	}
}
NotificationGroup.prototype.appendRatings = function(obj) {
	var notification = obj.notification,
		requesterID  = obj.id,
		ratings      = obj.ratings;

	console.log("ratings", obj);

	// Would be nice to have a chart-looking icon
	var element = $('<div class="ratings"><div class="ratings-button" style="float: left"><div class="ratings-chart"></div></div></div>');

	if (ratings) {
		element.find(".ratings-chart").append('\
				<table><tbody>\
					<tr><td>Communicativity</td><td>' + ratings.attrs.comm + '</td></tr>\
					<tr><td>Pay</td>            <td>' + ratings.attrs.pay  + '</td></tr>\
					<tr><td>Fairness</td>       <td>' + ratings.attrs.fair + '</td></tr>\
					<tr><td>Quickness</td>      <td>' + ratings.attrs.fast + '</td></tr>\
				</tbody></table>\
			');
	} else {
		element.find(".ratings-chart").append('No ratings available for this requester.');
	}
	
	notification.find(".requester").before(element);


}
NotificationGroup.prototype.createDOMElement = function() {
	var _this = this,
		REQUESTER_PREFIX = "https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&requesterId=",
		hit = this.hits[0];

	var div = $('<div>').addClass("notification_group")
		.append((this.title !== null) ? $('<h3>').html(this.title) : "")
		.append((Hit.isSameRequester(this.hits)) ? $('<h4><a href="' + REQUESTER_PREFIX + hit.requesterID + '" target="_blank" class="requester">' + hit.requester + '</a></h4>') : "")
		.hover(
			function() { _this.isHovered = true },
			function() {
				_this.isHovered = false;

				if (_this.hasTimedOut && typeof _this.onTimeout === 'function')
					_this.onTimeout(_this);
			}
		);
	
	var isSameReq = Hit.isSameRequester(this.hits);
	for (var i = 0, len = this.hits.length; i < len; i++)
		$(div).append((new NotificationHit(this.hits[i], isSameReq, (typeof this.watcher !== 'undefined') ? this.watcher : null)).getDOMElement());
	
	if (this.hits[0].isAutoAccept)
		div.addClass("autoaccept");

	this.DOMElement = div;

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
	var notification = $('<div>').addClass("notification")
		.append($('<a class="title" target="_blank"></a>')
			.attr('href', hit.getURL('preview'))
			.attr('title', hit.title)
			.text(hit.title))
		.append(
			(!this.isSameReq) ? $('<a class="requester">').attr('href', URL_PREFIX + hit.requesterID).attr('target', "_blank").html(hit.requester) : "")
		.append($('<p>' + hit.reward + " - " + hit.available + " rem. - " + hit.time.replace("minutes", "mins") + '</p>'))
		.append($('<div class="links"></div>'))
		.append($('<div><a class="mute"></a></div>'))
		.data("requesterID", hit.requesterID);

	// Add links
	if (typeof hit.id !== 'undefined' && hit.id !== "undefined" && hit.isQualified) {
		if (this.hit.isAutoAccept) {
			$(".links", notification)
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('view')).attr('target', "_blank").html("VIEW"))
				.append(
					$('<a>').addClass("hit_link").attr('href', "javascript:void(0)").html("STACK")
						.click(function(e) {
							e.preventDefault();
							sendMessage({ header: "stack", content: hit.id, timestamp: true });
						})
					)
				.append(
					$('<a>').addClass("hit_link").attr('href', "javascript:void(0)").html("QUEUE")
						.click(function(e) {
							e.preventDefault();
							sendMessage({ header: "queue", content: hit.id, timestamp: true });
						})
					);
		} else {
			$(".links", notification)
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('preview')).attr('target', "_blank").html("PREVIEW"))
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('accept')).attr('target', "_blank").html("ACCEPT"))
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('auto')).attr('target', "_blank").html("+AUTO"));
		}
	} else {
		$(notification).addClass("not_qualified");
		$(".links", notification)
			.append((hit.canPreview) ?
				$('<a>').addClass("hit_link").attr('href', hit.getURL('preview')).attr('target', "_blank").html("PREVIEW") : "")
			.append($('<span class="extra_info">').html("Not Qualified&nbsp;&nbsp;"));
	}
	
	
	var id = hit.id;
	var muteButton = $('a.mute', notification);
	
	$(muteButton).text((typeof dispatch !== 'undefined' && dispatch.isMuted(id)) ? "muted" : "mute");
	$(muteButton).click(function () {
		if (!pageType.DASHBOARD || (pageType.DASHBOARD && !pageType.MAIN)) {
			if ($(this).text() === "mute")
				sendMessage({ header: "mute_hit", content: id, timestamp: true });
			else
				sendMessage({ header: "unmute_hit", content: id, timestamp: true });
		} else {
			if (!dispatch.isMuted(id))
				dispatch.mute(id);
			else
				dispatch.unmute(id);
		}

		if ($(this).text() === "mute")
			$(this).text("muted");
		else
			$(this).text("mute");
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