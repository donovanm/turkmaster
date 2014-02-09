// ==UserScript==
// @name        Mturk Notifier test
// @namespace   12345
// @description Testing out stuff for a notifier for Mturk
// @include     https://www.mturk.com/mturk/*
// @include		https://www.mturk.com/mturk/dashboard
// @include		https://www.mturk.com/mturk/myhits
// @version     0.88
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js
// @grant       none
// ==/UserScript==

var isDashboard = false;
var isMain = true;		// Need a way to determine the main dashboard in case multiple dashboards are open. This is so remote watcher
					    // requests don't add new watchers to multiple pages and cause mturk errors.
var wasViewed = false;
var dispatch;
var notificationPanel; 

// Options
var isSoundOn = true;
var isAnimationOn = true;

$(document).ready(function(){
    var base, qryRequester, qryUrl, qryReward, qryTitle;
	
	checkIfDashboard();
	
	if (isDashboard) {
		dispatch = new Dispatch();
		createDispatchPanel();
		createDetailsPanel();
		loadHits();
		requestMain();
	}
	
	if (isHitPreview()) {
		addHitWatchButton();
	}
	
	notificationPanel = new NotificationPanel();
	
	// Listen to messages
	window.addEventListener('storage', onStorageEvent, false);
}); 

$(window).unload(function() {
	dispatch.ignoreList.save();
});


function checkIfDashboard() {
	if (document.URL == "https://www.mturk.com/mturk/dashboard")
		isDashboard = true;
}

function requestMain() {
	localStorage.setItem('notifier_request_main', new Date().getTime());
	// console.log("Requesting main dashboard rights");
}

function addWatcher(groupId, duration, type, name) {
	var msg = groupId + "`" + duration + "`" + type + "`" + name + "`" + "true";
	localStorage.setItem('add_hit', msg);
}
function addHitWatchButton() {
	var box = $(".message.success h6");
	// console.log("BOX");
	// console.log(box);
	var groupId = document.URL.match(/groupId=([A-Z0-9]+)/)[1];
	
	var button = $("<div>").addClass("watcher_button")
		.append($("<a>").text("Watch this hit?").attr('href', "javascript:void(0)"));
	var form = $("<div>").attr('id', 'add_watcher_form');
	form.html("<h3>Add a watcher</h3>\
				<p>Name <input id=\"watcherName\" type=\"text\" />\
				&nbsp;&nbsp; Time <input id=\"watcherDuration\" type=\"text\" /> sec<br />\
				<input type=\"button\" value=\"Save\"/>\
				<input type=\"button\" value=\"Cancel\"/></p>");
	form.hide();
	
	$(button).click(function () {
		form.show();
	});
	
	$("input[value='Save']", form).click(function() {
		var duration = parseInt($("#watcherDuration", form).val(), 10);
		
		// We will have to send a message to the dashboard to tell it to add a new watcher with these parameters. addWatcher() will be the function.
		addWatcher(groupId, duration * 1000, 'hit', $("#watcherName", form).val());
		$(form).hide();
	});
	
	$("input[value='Cancel']", form).click(function() {
		$(form).hide();
	});
	
	if (box.length == 0) {
		box = $("#javascriptDependentFunctionality");
		
		if (box.length == 0)
		 box = $("body > form:nth-child(7) > table:nth-child(9) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1)");
		// box = $("body > form:nth-child(7) > table:nth-child(8) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1)");
	}
	box.append(button);
	$("body").append(form);
	
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
			font: 9pt Verdana;\
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
			padding: 9px;\
			font: 11pt Verdana;\
			}\
		.watcher_button { display: inline; }\
		.watcher_button a { text-decoration: none; margin-left: 3em;	}\
		.watcher_button a:hover { text-decoration: underline; }\
		");
}

function addStyle(styleText) {
	var style = "<style type=\"text/css\">" + styleText + "</style>";
	$("head").append(style);
}

function isHitPreview() {
	if (document.URL.match(/https:\/\/www.mturk.com\/mturk\/(preview|accept).+groupId=.*/) != null)
		return true;
	return false;
}

function loadHits() {
	// Add a few watchers. Won't be done like this in the future
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=survey&minReward=0.75&qualifiedFor=on&x=13&y=10", 25000, 'url', "Surveys $0.75 and up")); //$.75 surveys
	// dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=study&minReward=0.50&qualifiedFor=on&x=13&y=10", 22000, 'url', "Studies $0.50 and up")); //$.50 studies
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=survey&minReward=0.25&qualifiedFor=on&x=13&y=10", 30000, 'url', "Surveys $0.25 and up")); //$.25 surveys
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=qualification&minReward=0.00&x=0&y=0", 300000, 'url', "Qualification HITs")); // Qualification HITs
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=transcribe&minReward=0.60&qualifiedFor=on&x=0&y=0", 60000, 'url', "Transcription HITs")); // Transcription HITs
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=Laura+Harrison&minReward=0.00&x=7&y=1", 10000, 'url', "Easy $8 survey"));
	dispatch.add(new Watcher("2FH56XBAT2D5VV0DSCUQ8JGA0ZV048", 20000, 'hit', "25 seconds of audio")); // crowdsurf hit
	dispatch.add(new Watcher("2C4PHMVHVKCJ6T0G85VJB9LU493538", 180000, 'hit', "Crowdsource .20 keywords")); // crowdsource
	// dispatch.add(new Watcher("2KGJ1XERSQV6DMLJAXK3PVWF2PL088", 20000, 'hit', "ACME English", {auto:true}));
	// dispatch.add(new Watcher("2IUC1QP6AUC2D8G00SSXBV0KS4C07H", 30000, 'hit', "ACME Transcription", {alert:true}));
	// dispatch.add(new Watcher("2HGWQIHPCGJ6H9UR6LWXR0JPSTN175", 15000, 'hit', "Taskrabbit Auto", {auto:true}));
	// dispatch.add(new Watcher("2FH56XBAT2D9NQFBUKUQAJG7U3M04G", 15000, 'hit', "$10 hit", {auto:true}));
	// dispatch.add(new Watcher("2RTSP6AUC26HG6O1Q2UVAFK2DRN29X", 13000, 'hit', "$20 Market Research", {auto:true}));
	dispatch.add(new Watcher("2PBXCNHMVHVKTTYQLPT7AJ7GOYX13M", 15000, 'hit', "Receipt hit"));
	// dispatch.add(new Watcher("2YEAJIA0RYNJTANGW8R5HMJ0YM4613", 60000, 'hit', "RnR caption", true)); // RnR caption
	// dispatch.add(new Watcher("A19NF3HMR2SC0H", 10000, 'requester', "Sirius Project"));
	dispatch.add(new Watcher("A11L036EBWKONR", 14000, 'requester', "Project Endor*", {alert:true}));	// Endor
	dispatch.add(new Watcher("A2ELUBUNBP6BLE", 60000, 'requester', "UW Social Media Lab*", {alert:true}));	// UW Social Media Lab
	dispatch.add(new Watcher("A35GBZ8TKR3UKC", 20000, 'requester', "Andy K*", {alert:true}));	// Andy K
	dispatch.add(new Watcher("A2BAP2QO7MMQI9", 60000, 'requester', "Product RnR*", {alert:true}));	// RnR
	dispatch.add(new Watcher("A2S0QCZG8DTNJC", 20000, 'requester', "Procore Development*", {alert:true}));	// Procore Development
	dispatch.add(new Watcher("A1ZCUBP2G0ZGZM", 200000, 'requester', "Bluejay Labs*", {alert:true})); // Bluejay
	dispatch.add(new Watcher("AI2HRFAYYSAW7", 60000, 'requester', "PickFu")); // PickFu
	// dispatch.add(new Watcher("https://www.mturk.com/mturk/findhits?match=false", 20000, 'url', "Newest HITs")); // Newist HITs
	// dispatch.add(new Watcher("ALS85546QW4UL", 120000, 'requester', "Sunghyun Park ($1 movie hits)"));
	dispatch.add(new Watcher("A32WH2887E2DAC", 300000, 'requester', "Grant Stewart"));
	dispatch.add(new Watcher("A11HABGEZWI0OZ", 30000, 'requester', "Jason Kaminsky"));	// Kaminsky
	dispatch.add(new Watcher("AKEBQYX32KM19", 45000, 'requester', "Crowdsurf"));		// Crowdsurf
	dispatch.add(new Watcher("A1EXB5EHTKUO8O", 600000, 'requester', "FoodEssentials")); // Foodessentials
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=Scott Appling&minReward=0.00&x=0&y=0", 60000, 'url', "Scott Appling (twitter)"));
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=taskrabbit&minReward=0.00&x=0&y=0", 30000, 'url', "Taskrabbit")); // Taskrabbit
	// dispatch.add(new Watcher("A14AT838CPSKA6", 240000, 'requester', "Venue Quality")); // Venue Quality
	dispatch.add(new Watcher("A6YG5FKV2TAVC", 300000, 'requester', "Agent Agent"));	// Agent Agent
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=set+master&minReward=0.00&x=0&y=0", 180000, 'url', "SET Master")); // SET Master
	dispatch.add(new Watcher("AO1GS3CMM2IGY", 180000, 'requester', "Five Star")); // Five Star
	// dispatch.add(new Watcher("AU22B6CPBQVG4", 600000, 'requester', "Dan Barowy (autoqual)", true));
	// dispatch.add(new Watcher("A1FDJ65X0XFT5M", 180000, 'requester', "ATA (Twitter sentiments check TO)")); // ATA
	dispatch.add(new Watcher("A5QQWO2U81GM6", 180000, 'requester', "VoxPopMe (transcription)")); // VoxPopMe
	dispatch.add(new Watcher("A2BXT12GC0UVMU", 300000, 'requester', "Ghinwa F Choueiter (tag a blog)")); // Ghinwa F Choueiter (tag a blog)
	dispatch.add(new Watcher("A2PZOEIMR3MMZ", 120000, 'requester', "John Hopkins sentiments")); // John Hopkins
	dispatch.add(new Watcher("A1TI16GBKWZ4M8", 600000, 'requester', "OCMP")); // OCMP
	// dispatch.add(new Watcher("A3T8FT460R1D09", 300000, 'requester', "Penserra Securities")); // Penserra Securities
	// dispatch.add(new Watcher("A3M0FXH8S3MV1V", 240000, 'requester', "SkillPages (potentially good)")); // SkillPages (needs private qual - password in qual test)
	dispatch.add(new Watcher("A2S0VJE25JPZ4P", 120000, 'requester', "Turknology")); // Business classification ($0.20 batch)
	dispatch.add(new Watcher("A1M46I0H8KNEEX", 600000, 'requester', "Crowd Watson")); // Crowd Watson
	dispatch.add(new Watcher("A1ABWLJ5FAEBU5", 600000, 'requester', "Tyler Wry (batches)")); // Tyler Wry
	dispatch.add(new Watcher("A3AKVXFARRH128", 600000, 'requester', "SaasSoft LLC. (tombstone)")); // SaasSoft LLC.
	// dispatch.add(new Watcher("A2PZOEIMR3MMZ", 400000, 'requester', "Sentiment hits"));
	dispatch.add(new Watcher("A2WSI50PTXWAEL", 300000, 'requester', "Daniel Holst 75c batch")); // Using Crowd Sourcing to Measure Surgical Performance
	dispatch.add(new Watcher("A1G19FR6J7V23R", 300000, 'requester', "Dialogue Systems (speaking batch)")); // .45 batch
	dispatch.add(new Watcher("A1BR3YO0W5G0TS", 300000, 'requester', "Zoya")); // Supposed to be decent
	// dispatch.add(new Watcher("A35RS8L3O9PKNB", 420000, 'requester', "VidAngel")); // VidAngel
	dispatch.add(new Watcher("A2MCCC2QUF1Y5E", 60000, 'requester', "James Goldsmith"));
	// dispatch.add(new Watcher("A1402D8IUJQZ0D", 600000, 'requester', "World Vision")); // World Vision
	// dispatch.add(new Watcher("A2FRGMSACA9M8H", 310000, 'requester'));	// Two Lakes
	// dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=natalia kogay&minReward=0", 301000, 'url', "Natalia Kogay"));	// Natalia Kogay (search)
	// dispatch.add(new Watcher("A3L9KG1K0UGWDO", 60000, 'requester', "JenniferK (transcription)")); // JenniferK (transcription)
	// dispatch.add(new Watcher("A3A1AJ4RPLTOLY", 60000, 'requester', "ACME Data Collection")); // ACME Data Collection
	// dispatch.add(new Watcher("A17PCU7QWXDWDU", 80000, 'requester', "John Gallagher (transcription)")); // John Gallagher (transcription)
	dispatch.add(new Watcher("A10LQ5X6HAAY6V", 600000, 'requester', "TELEDIA-CMU")); // TELEDIA-CMU (judge sentiments)
	// dispatch.add(new Watcher("A31NSBEMK3AKS1", 600000, 'requester', "TR (business info batches)")); // Business info $0.15
	dispatch.add(new Watcher("A3PBUB3OM54I27", 100000, 'requester', "cslab")); // cslab (batches)
	dispatch.add(new Watcher("A2UHX2LSVVA3N4", 100000, 'requester', "Michael Iarrobino")); // Michael Iarrobino (newsletter batch)
	dispatch.add(new Watcher("A3EG46USIUDWGA", 80000, 'requester', "KB (decent batches)")); // KB (decent batches)
	dispatch.add(new Watcher("https://www.mturk.com/mturk/searchbar?selectedSearchType=hitgroups&searchWords=amazon+requester&minReward=0.00&qualifiedFor=on&x=6&y=8", 600000, 'url', "Amazon Requester (qualified)")); // Trying to find some Amazon Requester hits I can do or at least quals
	// dispatch.add(new Watcher("A244AEXZLYKAD9", 90000, 'requester', "Affective Cog Neuro Lab 09")); // Good batch if they put out one I can qualify for
	updateDispatchPanel();
}

function start() {
	dispatch.start();
}

function onStorageEvent(event) {
	switch(event.key) {
		case 'notifier_message': 
			// Notify server if the tab was in focus when the message was received.
			// This is so we can determine whether or not to send a browser notification
			// that'll show up everywhere.
			if (!isDashboard || (isDashboard && !isMain)) {
				var message = JSON.parse(event.newValue);
				var hits = message.hits;
				
				// Re-create the hits so their methods can be used
				for(var i = hits.length; i--;) hits[i] = new Hit(hits[i]);

				// Show the hits and let the dashboard know it was seen
				if (document.hasFocus())
					localStorage.setItem('notification_viewed', new Date().getTime());
				notificationPanel.add(new NotificationGroup(message.title, hits));
			}
			break;
		case 'notification_viewed' :
			if (isDashboard) {
				wasViewed = true;
			}
			
			break;
		case 'add_hit' : 
			if (isDashboard && isMain) {
				var data = event.newValue.split('`');
				var id = data[0];
				var duration = data[1];
				var type = data[2];
				var name = data[3];
				var autoAccept = (data[4] == "true");
				
				dispatch.add(new Watcher(id, duration, 'hit', name, {auto:autoAccept})).start();
				
				updateDispatchPanel();
			}
			break;
		case 'mute_hit' :
			if (isDashboard) {
				var id = event.newValue.split(',')[0];
				if (!dispatch.isMuted(id)) {
					dispatch.mute(id);
					console.log("Remote mute (" + id + ")");
				} 
			}
			break;
		case 'unmute_hit' :
			if (isDashboard) {
				var id = event.newValue.split(',')[0];
				if (dispatch.isMuted(id)) {
					dispatch.unmute(id);
					console.log("Remote unmute (" + id + ")");
				}
			}
			break;
		case 'notifier_request_main' :
			if (isDashboard && isMain)
				localStorage.setItem('notifier_request_denied', new Date().getTime());
			break;
		case 'notifier_request_denied' :
			if (isDashboard && isMain) {
				dispatch.onRequestMainDenied();
			}
			break;
	}
}

/** This function takes an array of hits and determines if they are all from the same requester

	argument	Hit[] hits		Array of hits to be evaluated
	return		bool			Returns true if all hits have the same requester
**/
function isSameRequester(hits) {
	if (this.length == 1) return false;
	if (hits.length > 1) {
		var compareRequester = hits[0].requester;
		for (i = 1; i < hits.length; ++i) {
			if (compareRequester != hits[i].requester)
				return false;
		}
	}
	return true;
}

function sendBrowserNotification(hits, watcher) {
	// Let's check if the browser supports notifications
    if (!("Notification" in window)) {
		alert("This browser does not support desktop notification");
    }

	// Let's check if the user is okay to get some notification
	else if (Notification.permission === "granted") {
		// If the user isn't on a mturk page to receive a rich notification, then send a web notification
		if (!wasViewed) {
			var bodyText = "";
			
			for (i = 0; i < hits.length; i++)
				bodyText += "\n" + hits[i].title.substring(0, 35) + ((hits[i].title.length > 35) ? "..." : "") + "\n" + hits[i].reward + "\n";

			var notification = new Notification(
				watcher.name,
				{ 
					body: bodyText,
					icon: "http://halfelf.org/wp-content/uploads/sites/2/2012/06/amazon_icon.png"
				}
			);
			notification.onclick = function() {
				window.focus();
				this.close();
				showDetailsPanel(watcher);
			};
			notification.onshow = function() { setTimeout(function() { notification.close() }, 5000) };
		}
	}

	// Otherwise, we need to ask the user for permission
	// Note, Chrome does not implement the permission static property
	// So we have to check for NOT 'denied' instead of 'default'
	else if (Notification.permission !== 'denied') {
		requestWebNotifications();
	}
}

function requestWebNotifications() {
	window.Notification.requestPermission(function (permission) {
		// Whatever the user answers, we make sure Chrome stores the information
		if(!('permission' in Notification))
			window.Notification.permission = permission;

		// If the user is okay, let's create a notification
		if (permission === "granted")
			new window.Notification("Notifications enabled.");
	});
}


// This is the Hit object
function Hit(attrs) {
	var attrs = attrs || {};
	this.id 			= attrs.id;
	this.uid 			= attrs.uid;
	this.isAutoAccept 	= attrs.isAutoAccept || false;
	this.requester 		= attrs.requester;
	this.url 			= attrs.url;
	this.title 			= attrs.title;
	this.reward 		= attrs.reward;
	this.description 	= attrs.description;
	this.available 		= attrs.available;
	this.time 			= attrs.time;
}
Hit.prototype.getURL = function(type) {
	switch(type) {
	case 'preview':
		return "https://www.mturk.com/mturk/preview?groupId=" + this.id;
		break;
	case 'accept':
		return "https://www.mturk.com/mturk/previewandaccept?groupId=" + this.id;
		break;
	case 'auto':
		return "https://www.mturk.com/mturk/previewandaccept?groupId=" + this.id + "&autoAcceptEnabled=true";
		break;
	case 'view':
		return "https://www.mturk.com/mturk/continue?hitId=" + this.uid;
		break;
	case 'return':
		// This will need to be changed. It's the same as 'view' until more testing is done on AMT's return functionality
		return "https://www.mturk.com/mturk/preview?hitId=" + this.uid;
		break;
	default:
		return "";
	}
}

// Message object
function Message() {
	/*  Status (changed): Unchanged, Added, Removed, Count
		We should mark each Hit in the message with what has changed. The count change should be sent with this.
		The message will also tell the client whether or not to pop-up the notification.	*/
}

// Create the panel for dispatch
function createDispatchPanel() {
	var pageElements = $("body > *");
	$("body").html("");
	$("body").append(
		$("<div>")
			.attr('id', "content_container")
			.append($(pageElements))
	);
	$("body").prepend(dispatch.getHTML());
	addStyle("#dispatcher { background-color: #f5f5f5; position: fixed; top: 0px; float: left; height: 100%;  width: 270px; font: 8pt Helvetica;  margin-left: -5px }\
		#content_container { position: absolute; left: 270px; top: 0; right: 0; border-left: 2px solid #dadada }\
		#dispatcher #controller { text-align: center; font: 200% Candara; position: relative; height: 25px; }\
		#dispatcher #controller .on_off { margin: 7px 5px 0 0 }\
		#dispatcher #controller .on_off a { font: 80% Helvetica }\
		#dispatcher #watcher_container { position: absolute; top: 25px; bottom: 0; overflow-y:auto;}\
		#dispatcher #watcher_container a.close { text-decoration: none; color: #555; background-color: #fff; padding: 3px 10px; border: 1px solid #aaa; border-radius: 2px }\
		#dispatcher #watcher_container a.close:hover { background-color: #def; border-color: #aaa }\
		#dispatcher #settings { float: left; margin: 3px 2px }\
		#dispatcher div { font-size: 8pt }\
		#dispatcher .watcher { margin: 3px; background-color: #fff; position: relative; border-bottom: 1px solid #ddd; border-right: 1px solid #ddd; }\
		#dispatcher .watcher .details { width: 25px; text-align: center; float: right; background-color: rgba(234, 234, 234, 1); position: absolute; top: 0; bottom: 0; right: 0; font: 90% Verdana; color: #fff; }\
		#dispatcher .watcher .name { font: 110% Helvetica; color: black; text-decoration: none; font-weight: bold}\
		#dispatcher .watcher .name:hover { text-decoration: underline }\
		#dispatcher .on_off{ float: right; cursor: pointer }\
		#dispatcher .on_off a { margin: 1px; font: 70% Helvetica; }\
		#dispatcher .on_off a.selected { background-color: #cef; border-radius: 3px; padding: 3px 6px; }\
		#dispatcher .watcher div:nth-child(2) {  margin-right: 25px; padding: 5px 5px 5px 10px;}\
		#dispatcher .watcher .bottom { margin-top: 0px;  }\
		#dispatcher .watcher .bottom a:link { color: black; }\
		#dispatcher .watcher .bottom a:hover { color: #cef; }\
		#dispatcher .watcher .details { font-size: 150%; font-weight: bold }\
		#dispatcher .watcher .last_updated { position: absolute; right: 40px; bottom: 5px; color: #aaa }\
		#dispatcher .watcher .edit { visibility: hidden; position: absolute: left: 5px; bottom: 5px; }\
		#dispatcher .watcher .color_code { position: absolute; left: 0; top: 0; bottom: 0; width: 5px }\
		#dispatcher .watcher .color_code.hit 		{ background-color: rgba(234, 111, 111, .7); }\
		#dispatcher .watcher .color_code.requester 	{ background-color: rgba(51, 147, 255, .7); }\
		#dispatcher .watcher .color_code.url 		{ background-color: rgba(58, 158, 59, .7); }");
}

function updateDispatchPanel() {
	if (isMain) {
		$("#watcher_container").html("");
		for (i = 0; i < dispatch.getWatcherCount(); ++i)
			$("#watcher_container").append(dispatch.getWatcher(i).getHTML());
	}
}

// The details panel for each watcher
function createDetailsPanel() {
	var div = $('<div>').attr('id', 'details_panel').addClass('notification_panel');
	addStyle("#details_panel {\
		background-color: #fff;\
		position: fixed; top: 0px;\
		margin-left: 6px;\
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

function showDetailsPanel(watcher) {
	var hits = watcher.lastHits;
	var type = watcher.type;
	var panel = $("#details_panel");
	
	$("*", panel).remove();

	if (hits.length > 0) {
		$(panel).append((new NotificationGroup(null, hits, false, watcher)).getDOMElement());
	} else {
		$(panel).append($('<div>').append('<h2>').css('text-align', 'center').text("There are no HITs avaialable."));
	}
	$(panel).show();
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

	if (storedItems != null) {
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
}
IgnoreList.prototype.clear = function() {
	this.items = new Array();
	localStorage.removeItem('notifier_ignore');
}
IgnoreList.prototype.stop = function() {
	clearInterval(this.interval);
}
IgnoreList.prototype.contains = function(item) {
	return (this.items.indexOf(item) != -1);
}
IgnoreList.prototype.add = function(item) {
	if (!this.contains(item))
		this.items.push(item);
}
IgnoreList.prototype.remove = function(item) {
	if (this.contains(item)) {
		var pos = this.items.indexOf(hitID);
		var newList = new Array();
		
		for (var i = 0; i < this.items.length; i++) {
			if (i != pos)
				newList.push(this.items[i]);
		}
		this.items = newList;
	}
}

/** Dispatch object. Controls all of the watchers.

**/
function Dispatch() {
	this.isRunning = false;
	this.watchers = new Array();
	this.ignoreList = new IgnoreList();
}
Dispatch.prototype.start = function() {
	// For now start all watchers
	if (this.watchers.length > 0) {
		var count = 0;
		for (i = 0; i < this.watchers.length; ++i) {
			// Don't start them all at the same time. There is a 2 second delay
			// between each start. It had to be done in a self-executing function
			// in order for the setTimeout to work properly.
			if (this.getWatcher(i).isOn) {
				(function (watcher, x){
						watcher.timer = setTimeout(function() { watcher.start(); }, x * 2000);
				})(this.getWatcher(i), count++);
			}
		}
	}
	this.isRunning = true;
}
Dispatch.prototype.stop = function() {
	// Stop all Watchers
	if (this.watchers.length > 0) {
		for (i = 0; i < this.watchers.length; ++i)
			this.watchers[i].stop();
	}
	this.isRunning = false;
	this.interruptStart = true;
}
Dispatch.prototype.add = function(watcher) {
	this.watchers.push(watcher);
	return watcher;
}
Dispatch.prototype.remove = function(watcher) {
	var newArray = new Array();

	for (i = 0; i < this.watchers.length; ++i) {
		if (this.watchers[i] != watcher)
			newArray.push(this.watchers[i]);
	}
	this.watchers = newArray;
}
Dispatch.prototype.getWatcherById = function(id) {
	if (this.watchers.length > 0) {
		for (i = 0; i < this.watchers.length; ++i) {
			if (this.watchers[i].id == id)
				return this.watchers[i];
		}
	}
	return null;
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
		.css('padding', "5px")
		.css('text-align', "center")
		.append($("<p>")
			.text("There is already a notifier running on a different page."))
		.append($("<a>")
			.html("Close")
			.addClass("close")
			.attr('href', "javascript:void(0)")
			.click(function() {
				$("#dispatcher").css('display', "none");
				$("#content_container").css('left', "0px");
				})
			);
}
Dispatch.prototype.getHTML = function() {
	// Create the HTML to display the dispatcher
	var html = $("<div>").attr('id', "dispatcher")
		.append($("<div>").attr('id', "controller"))
		.append($("<div>").attr('id', "watcher_container"));
	
	$("#controller", html)
		.append($("<a>")
			.attr('id', "settings")
			.attr('href', "javascript:void(0)")
			.attr('title', "Settings")
			.html("<img src=\"http://qrcode.littleidiot.be/qr-little/site/images/icon-settings.png\" />")
			.click(function() { requestWebNotifications(); })
		)
		.append("Mturk Notifier")
		.append("<div class=\"on_off\"><a" + (dispatch.isRunning ? " class=\"selected\"" : "") + ">ON</a><a" + (!dispatch.isRunning ? " class=\"selected\"" : "") + ">OFF</a></div>");

	$("#controller .on_off a", html).click(function() {
		var on = $("#controller .on_off a:first-child", html);
		var off = $("#controller .on_off a:last-child", html);

		if (!dispatch.isRunning) {
			start();
			$(on).addClass("selected");
			$(off).removeClass("selected");
		} else {
			$(on).removeClass("selected");
			$(off).addClass("selected");
			dispatch.stop();
		}
	});
	
	return html;
}
Dispatch.prototype.onRequestMainDenied = function() {
	isMain = false;
	this.hideWatchers();
	this.ignoreList.stop();
}

/** The QuickWatcher simply refreshes the first page for new hits (every 1 second or so) and tries to 
	match any requester on the list that shows up on the page. Could possibly iterate through each
	requester initially before doing the quick refresh.
	
	Experimental.
**/
function QuickWatcher() { var requester = new Array(); }

/**	The Watcher object. This is what controls the pages that are monitored and how often

**/
function Watcher(id, time, type, name, options) {
	var id, time, type, name, url;
	var date;
	this.interval = null;		// For continuous interval
	this.timer = null; 			// For initial setTimeout
	this.lastHits = new Array();
	this.newHits = new Array();

	// Default states
	this.isRunning = false;
	this.isOn = true;
	this.isUpdated = false;
	
	// Basic attributes
	this.id = id;
	this.time = time;
	this.type = type;
	this.name = name;
	
	// Options
	var options = options || {};
	this.auto 			= options.auto || false;
	this.isAlert 		= options.alert || false;
	this.stopOnCatch 	= options.stopOnCatch || true;

	// Figure out the URL
	switch(this.type) {
		case 'hit':
			this.url = "https://www.mturk.com/mturk/preview" + (this.auto ? "andaccept" : "") + "?groupId=" + this.id;
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
	
	return this;
}
Watcher.prototype.getHTML = function() {
	// Create the HTML (with the necessary variables to visualize the watcher)
	var div = $('<div>')
		.attr('id', this.id)
		.addClass("watcher");
		
	var html = "<div class=\"details\"> > </div>\
		<div>\
		<div class=\"on_off\"><a" + (this.isOn ? " class=\"selected\"" : "") + ">ON</a><a" + (!this.isOn ? " class=\"selected\"" : "") + ">OFF</a></div>\
		<a class=\"name\" href=\"" + this.getURL() + "\" target=\"_blank\">" + ((typeof this.name != 'undefined') ? this.name : this.id) + "</a><br />" +
		(this.time / 1000) + " seconds <a class=\"edit\" href=\"javascript:void(0)\">Edit</a>\
		<div class=\"bottom\">\
			<div class=\"last_updated\" title=\"Last checked\">" + ((typeof this.date != 'undefined') ? formatTime(this.date) : "n/a") + "</div>\
		</div>\
		<div class=\"color_code\"></div>\
		</div>";
		
	$(div).append(html);
	
	var colorCode = $(".color_code", div);
	if (this.type == 'hit') {
		colorCode.addClass("hit");
		colorCode.attr('title', "HIT Watcher");
	} else if (this.type == 'requester') {
		colorCode.addClass("requester");
		colorCode.attr('title', "Requester Watcher");
	} else if (this.type == 'url') {
		colorCode.addClass("url");
		colorCode.attr('title', "URL Watcher");
	}

	var _this = this;
	$(".on_off", div).click(function() { _this.toggleOnOff(); } );
	$("a.name", div).click(function() { _this.markViewed(); });
	$(".details", div).mouseout(function() { _this.markViewed(); });
	$(".details", div).mouseover(function() { showDetailsPanel(_this); });
	$(div).hover(function() { $(".edit", this).css('visibility', 'visible'); }, function() { $(".edit", this).css('visibility', 'hidden'); });
	return div;
}
Watcher.prototype.getURL = function() {
	return this.url;
}
Watcher.prototype.isNewHit = function (hit) {
	return (this.newHits.indexOf(hit) != -1);
}
Watcher.prototype.onChanged = function() {
	this.highlight();
	this.isUpdated = true;
	
	// Sound alert for auto-accept HIT watchers and watchers that have the alert set on
	if (this.auto || this.isAlert)
		this.alert();
}
Watcher.prototype.start = function() {
	var _this = this;
	
	// Set the interval and start right away
	this.interval = setInterval(function(){ _this.getData() }, this.time);
	this.getData();
	
	this.isRunning = true;
}
Watcher.prototype.stop = function() {
	// Stop the interval object and the timer object
	clearInterval(this.interval);
	clearTimeout(this.timer);
	this.isRunning = false;
}
Watcher.prototype.filterMessages = function(newHits) {
	// Determine which hits, if any, the user should be notified of
	// For now just showing new hits
	var filteredHits = new Array();

	if (typeof this.lastHits != 'undefined' && this.lastHits.length > 0) {
		this.isChanged = false;
		
		for (i = 0; i < newHits.length; ++i) {
		
			// Check if the hit is on the ignore list first before wasting time going through the comparisons
			if (!dispatch.isMuted(newHits[i].id)) {
				// Compare URLs for now. Should just use IDs in the future
				for (j = 0; j < this.lastHits.length; ++j) {
					if (newHits[i].url == this.lastHits[j].url) {
						break;
					}
					
					// If we reach the end with no matches, add it to the changed hits array
					if (j == this.lastHits.length - 1 ) {
						filteredHits.push(newHits[i]);
						this.isChanged = true;
					}
				}
			}
		}

		if (this.isChanged)
			this.onChanged();

		this.lastHits = newHits;
		this.newHits = filteredHits;

		return filteredHits;
	}
	
	// If "last hits" doesn't exist, then all of the new hits should be considered new
	// console.log("Returning same hits");
	for (var i = 0; i < newHits.length; ++i)
		if (!dispatch.isMuted(newHits[i].id))
			filteredHits.push(newHits[i]);
	
	this.onChanged();
	this.lastHits = newHits;
	return filteredHits;
}
Watcher.prototype.toggleOnOff = function() {
	if (this.isOn) {
		this.stop();
		$("#" + this.id + " .on_off a:first-child").removeClass("selected");
		$("#" + this.id + " .on_off a:last-child").addClass("selected");
		this.isOn = false;
	} else {
		if (!this.isRunning)
			this.start();
		$("#" + this.id + " .on_off a:first-child").addClass("selected");
		$("#" + this.id + " .on_off a:last-child").removeClass("selected");
		this.isOn = true;
	}
}
Watcher.prototype.markViewed = function () {
	if (this.isUpdated) {
		this.unhighlight();
		isUpdated = false;
	}
}
Watcher.prototype.alert = function () {
	var sound = new Audio();
	
	if (sound.canPlayType('audio/ogg;codecs="vorbis"') && isSoundOn) {
		sound.src = "http://rpg.hamsterrepublic.com/wiki-images/3/3e/Heal8-Bit.ogg";
		sound.play();
	}
}
Watcher.prototype.highlight = function() {
	$("#dispatcher #" + this.id + " div.details").css('background-color', 'rgba(218, 240, 251, 1)');
}
Watcher.prototype.unhighlight = function() {
	$("#dispatcher #" + this.id + " div.details").css('background-color', 'rgba(234, 234, 234, 1)');
}
Watcher.prototype.updateLastChecked = function() {
	this.date = new Date();
}
Watcher.prototype.updateWatcherPanel = function() {
	this.updateLastChecked();
	$("#dispatcher #" + this.id + " .last_updated").text(this.getformattedTime());
}
Watcher.prototype.getformattedTime = function() {
	var time = this.date;
	var str = "";
	var hours = time.getHours();
	var ampm = "am";
	
	if (hours > 12) {
		hours -= 12;
		ampm = "pm";
	} else if (hours == 0) {
		hours = 12;
	}
		
	str += hours + ":" 
		+ ((time.getMinutes() < 10) ? "0" : "") + time.getMinutes() + ":"
		+ ((time.getSeconds() < 10) ? "0" : "") + time.getSeconds()
		+ ampm;
		
		return str;
}
Watcher.prototype.setHits = function(hits) {
	if (typeof hits !== 'undefined') {
		if (Object.prototype.toString.call(hits) != '[object Array]')
			hits = new Array(hits);
		this.sendHits(hits);
	}
	this.updateWatcherPanel();
}
Watcher.prototype.sendHits = function(hits) {
	// Only send the hits if there is actually something to send
	// In the near future this will have to be changed to show when HITs go away completely
	if (typeof hits != 'undefined' && hits.length > 0) {
		hits = this.filterMessages(hits);
		
		if (hits.length > 0) {
			wasViewed = false;

			// Send hits
			localStorage.setItem('notifier_message', JSON.stringify({'title':this.name, 'hits':hits},null,4));
			
			// Show notification on dashboard, too
			notificationPanel.add(new NotificationGroup(this.name, hits));

			// Attempt to send a browser notification after a brief period of time. If another mturk
			// page was visible when it received the hits, this will cancel out.
			if (!document.hasFocus()) {
				var _this = this;
				setTimeout(function() { sendBrowserNotification(hits, _this); }, 100);
			}
		}
	}
}
Watcher.prototype.getData = function() {
	var _this = this;
	$.get(this.url, function(data) {
		_this.onDataReceived($(data));
	});
}
Watcher.prototype.onDataReceived = function(data) {
	var error = $(".error_title", data);
	if (error.length > 0) {
		if (error.text().contains("You have exceeded"))
			return;
	}

	if (this.type == 'hit')
		this.setHits(this.parseHitPage(data));
	else
		this.setHits(this.parseListing(data));
}
Watcher.prototype.parseListing = function(data) {
	var hitCount = $("table:nth-child(3) > tbody:nth-child(1) > tr", data).length;
	var hits = new Array();

	for (var i = 0; i < hitCount; ++i) {
		base = "table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(" + (i+1) + ") > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > ";
		qryRequester = base + "tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > a";
		qryUrl = base + "tr:nth-child(2) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > span:nth-child(1) > a";
		qryReward = base + "tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > span:nth-child(1)"
		qryTitle = base + "tr:nth-child(2) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > a:nth-child(1)";
		qryAvailable = base + "tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(2)";
		qryTime = base + "tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(2) > td:nth-child(2)";

		var hit = new Hit();
		hit.requester = $(qryRequester, data).text();
		hit.requesterID = $(qryRequester, data).attr("href");
		hit.url = $(qryUrl, data).attr("href");
		hit.title = $(qryTitle, data).text().trim();
		hit.reward = $(qryReward, data).text().trim();
		hit.available = $(qryAvailable, data).text().trim();
		hit.time = $(qryTime, data).text().trim();
		
		var idMatch = hit.url.match(/groupId=([A-Z0-9]+)/);
		if (idMatch != null)
			hit.id = idMatch[1];

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
		
		if (hasCaptcha) console.log("Has captcha");

		var uid = $("input[name='hitId']", data).attr("value");
		var hit = new Hit({id: this.id, uid: uid, isAutoAccept: this.auto});
		hit.requester = $("form:nth-child(7) > div:nth-child(9) > div:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(3) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)", data).text().trim();
		hit.title = $(".capsulelink_bold > div:nth-child(1)", data).text().trim();
		hit.reward = $("td.capsule_field_text:nth-child(5) > span:nth-child(1)", data).text().trim();
		hit.available = $("td.capsule_field_text:nth-child(8)", data).text().trim();
		hit.time = $("td.capsule_field_text:nth-child(11)", data).text().trim();
		
		if ((hasCaptcha || this.auto) && this.isRunning)
			// We should probably toggle off all auto-accept hits when we encounter a captcha. Maybe send a special message to all mturk windows while we're at it.
			// The special message could be some kind of banner that says that no more hits can be accepted in the background until the captcha is entered. (It would
			// be pretty cool if we could pull up the captcha image in the background and just show it and the form to enter it from another page).
			this.toggleOnOff();
		
		return new Array(hit);
	}
}
/** Watcher Stack and Queue
	Stack - Grab as many as possible right away
		Limit - The number of HITs to stack at once
			Stop - Stop after the limit is reached
			Queue - Start queing after the limit is reached
			
	Queue - Grab one at a time, paced about as fast as they can be done
**/

/** The NotificationPanel object. This holds and manipulates incoming notification groups

**/
function NotificationPanel() {
	this.isHidden = true;
	this.notifications = new Array();
	this.createPanel();
}
NotificationPanel.prototype.add = function(notification) {
	var _this = this;
	
	// Get rid of the leftover notification if there's one there
	if (this.notifications.length > 0 && this.notifications[0].hasTimedOut) {
		var oldNotification = this.notifications[0];
		setTimeout(function() { _this.remove(oldNotification);}, 0000);
	}

	notification.onTimeout = function() { _this.onTimeoutListener(notification) };
	this.notifications.push(notification);
	this.addToPanel(notification);

	if (this.isHidden) {
		this.show();
	}
}
NotificationPanel.prototype.remove = function(notification) {
	this.removeFromPanel(notification);

	var newArray = new Array();
	for (var i = 0; i < this.notifications.length; i++)
		if (this.notifications[i] != notification)
			newArray.push(this.notifications[i]);
			
	this.notifications = newArray;
}
NotificationPanel.prototype.show = function() {
	if (this.isHidden) {
		if (document.hasFocus() && isAnimationOn) {
			this.animatePanel(-400, 0);
		} else {
			this.getDOMElement().css('right', "0px");
		}
	}
	this.isHidden = false;
}
NotificationPanel.prototype.hide = function() {
	if (!this.isHidden) {
		if (document.hasFocus() && isAnimationOn) {
			this.animatePanel(0, -400);
		} else {
			this.getDOMElement().css('right', "-400px");
		}
	}
	this.isHidden = true;
}
NotificationPanel.prototype.animatePanel = function(currentX, toX) {
	var _this = this;
	currentX += ((currentX < toX) ? 40 : -40);
	this.getDOMElement().css('right', currentX + "px");
	
	if (currentX != toX)
		this.animationTimeout = setTimeout(function() {  _this.animatePanel(currentX, toX); }, 10);
}
NotificationPanel.prototype.createPanel = function() {
	var _this = this;
	var panel =	$("<div>").addClass("notification_panel").attr('id', "receiver")
			.hover(function(){_this.show()}, function(){_this.hide()})

	$("body").append(panel);
	
	this.DOMElement = panel;

	addStyle("\
		#receiver.notification_panel { \
			position: fixed;\
			width: 400px;\
			bottom: 0px;\
			right: -400px;\
			background: rgba(255, 255, 255, 1);\
			padding: 5px;\
			font: 9pt Verdana;\
			border: 1px solid #d5d5d5;\
			border-size: 1px 0 0 1px;\
			overflow: auto;\
			border-radius:  5px 0 0 0;\
			}\
		#receiver .notification_group {\
			background: #fdfdfd;\
			border: 1px solid #eaeaea;\
			padding: 5px;\
			margin: 10px 0;\
		}\
		#receiver div { font-size: 8pt; }\
		#receiver .notification_group h3 { margin: 3px; font-face: verdana }\
		#receiver .notification_group h4 { margin: 2px 0 0 4px; color: #222; }\
		.notification_panel h2, #details_panel h2 { font-size: 100%; font-weight: normal; margin: 0px }\
		.notification { padding: 3px 3px 0 5px; background-color: #fff; border-bottom: 1px solid #e9e9e9; position: relative; font: 10pt Verdana; }\
		.notification:last-child { border: none; padding-bottom: 3px }\
		.notification .mute { position: absolute; bottom: 4px; right: 5px; color: #999; cursor: pointer; font-size: 7pt }\
		.notification p { margin: -13px 0 0; padding: 0 }\
		.notification_panel a:link, .notification_panel a:visited {\
			font-size: 130%;\
			text-decoration: none;\
			color: #6bf;\
			}\
		.notification_panel a.title:link, .notification_panel a.title:visited {\
			display:block;\
			white-space: nowrap;\
			overflow: hidden;\
			text-overflow: ellipsis;\
			margin-bottom: 0px;\
			font-size: 9pt;\
			}\
		.notification_panel .links {\
			position: absolute;\
			bottom: 6px;\
			right: 35px;\
			}\
		.notification_panel a.hit_link {\
			font-size: 8pt;\
			color: #fafafa;\
			background: #6bf;\
			border-radius: 1px;\
			display: inline;\
			margin: 10px 5px 0 0;\
			padding: 0 6px;\
			}\
		.notification_panel a.hit_link:visited { background-color: #9df; }\
		.notification_panel a strong { color:black; }\
		.notification_panel strong { font-size: 70%; }\
		.notification_panel a.hit_link:hover { background: #8df; }\
		.notification_panel p {	margin: 1px 0 6px 0; }\
		.notification_panel .autoaccept {\
			background-color: rgba(148, 236, 255, .3);\
			background-color: rgba(214, 255, 91, 1);\
		}\
		.notification.not_qualified { background-color: rgba(245, 244, 229, 1) }\
		.notification_panel .new { background-color: rgba(220, 255, 228, 1); }");
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
		if (document.hasFocus() && isAnimationOn) {
			notification.fadeOut(700);
			setTimeout(function() { _this.remove(notification) }, 705);
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
	this.title = title;
	this.hits = hits;
	this.isSticky = (typeof isSticky != 'undefined') ? isSticky : this.hasAutoAccept();
	this.timeout = (this.isSticky) ? 15000 : 6000;
	this.hasTimedOut = false;
	if (typeof watcher != 'undefined') this.watcher = watcher;
	
	var _this = this;
	setTimeout(function() {
		if (typeof _this.onTimeout != 'undefined' && _this.onTimeout != null) {
			_this.onTimeout(_this);
			_this.hasTimedOut = true;
		}
	}, this.timeout);	

	this.createDOMElement();
}
NotificationGroup.prototype.createDOMElement = function() {
	var div = $('<div>').addClass("notification_group")
		.append((this.title != null) ? $('<h3>').html(this.title) : "")
		.append((isSameRequester(this.hits)) ? $('<h4>').html(this.hits[0].requester) : "");
	
	var isSameReq = isSameRequester(this.hits);
	for (var i = 0; i < this.hits.length; i++)
		$(div).append((new NotificationHit(this.hits[i], isSameReq, (typeof this.watcher != 'undefined') ? this.watcher : null)).getDOMElement());
	
	this.DOMElement = div;
}
NotificationGroup.prototype.getDOMElement = function() {
	return this.DOMElement;
}
NotificationGroup.prototype.hasAutoAccept = function() {
	var hasAutoAccept = false;
	for (var i = 0; i < this.hits.length; i++)
		if (this.hits[i].isAutoAccept) hasAutoAccept = true;
	return hasAutoAccept;
}
NotificationGroup.prototype.fadeOut = function(duration) {
	$(this.getDOMElement()).fadeOut(duration);
}

/** The Notification object. This holds the notification data for individual hits

**/
function NotificationHit(hit, isSameReq, watcher) {
	this.hit = hit;
	this.isSameReq = isSameReq;
	if (typeof watcher != 'undefined') this.watcher = watcher;
	
	this.createDOMElement();
}
NotificationHit.prototype.createDOMElement = function() {
	// Create notification
	var hit = this.hit;
	var notification = $('<div>').addClass("notification")
		.append($('<a>')
			.addClass("title")
			.attr('href', hit.getURL('preview'))
			.attr('title', hit.title)
			.text(hit.title))
		.append((!this.isSameReq) ? $('<a>').attr('href', hit.requesterID).attr('target', "_blank").
			append($('<strong>').html(hit.requester)) : "")
		.append($('<p>')
			.html(hit.reward + " - " + hit.available + " remaining"))
		.append($('<div>').addClass("links"))
		.append($('<div>').addClass("mute"));

	// Add links
	if (typeof hit.id != 'undefined' && hit.id != "undefined") {
		if (this.hit.isAutoAccept) {
			$(".links", notification)
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('view')).attr('target', "_blank").html("View"))
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('preview')).attr('target', "_blank").html("Preview"))
				.append($('<a>').addClass("hit_link").attr('href', "javascript:queue(\'" + hit.id + "\')").attr('target', "_blank").html("Queue"));
		} else {
			$(".links", notification)
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('preview')).attr('target', "_blank").html("Preview"))
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('accept')).attr('target', "_blank").html("Accept"))
				.append($('<a>').addClass("hit_link").attr('href', hit.getURL('auto')).attr('target', "_blank").html("+Auto"));
		}
	} else {
		$(notification).addClass("not_qualified")
		$(".links", notification).append($('<em>').html("Not Qualified&nbsp;&nbsp;"));
	}
	
	
	var id = hit.id;
	var muteButton = $('<div>').addClass("mute");
	
	$(muteButton).text((typeof dispatch != 'undefined' && !dispatch.isMuted(id)) ? "mute" : "muted");
	$(muteButton).click(function () {
		if (!isDashboard) {
			if ($(this).text() == "mute")
				localStorage.setItem('mute_hit', id + "," + new Date().getTime());
			else
				localStorage.setItem('unmute_hit', id + "," + new Date().getTime());
		} else {
			if (!dispatch.isMuted(id))
				dispatch.mute(id);
			else
				dispatch.unmute(id);
		}

		if ($(this).text() == "mute")
			$(this).text("muted");
		else
			$(this).text("mute");
	});
	
	if (hit.isAutoAccept)
		$(notification).addClass("autoaccept");

	if  (typeof this.watcher != 'undefined' && this.watcher != null && this.watcher.isNewHit(hit))
		$(notification).addClass("new");

	$(notification).append(muteButton);
	
	this.DOMElement = notification;
}
NotificationHit.prototype.getDOMElement = function() {
	return this.DOMElement;
}

function queue(id) {
	localStorage.setItem("notifier_queue", id);
}