/**
 * @file send alert
 * @sends an SMS with alert information via Twilio
 * @author Nathaniel Taylor
 */

// Twilio Credentials 

const util = require('./util.js');
var twilio = require('twilio');
var sendalert={};

var client;

sendalert.initialize=function(config) {
	sendalert.instance = config.instance || "dev";
	sendalert.accountSid = config.twilio_accountSid;
	sendalert.authToken = config.twilio_authToken;
	sendalert.phonenumber = config.twilio_phonenumber;
	sendalert.fromphonenumber = config.twilio_fromphonenumber;
}
//require the Twilio module and create a REST client
// Send alert to every phone number in the dbconfig.twilio_phonenumber list
sendalert.alert=function(messagebody) {
	var	client = twilio(sendalert.accountSid, sendalert.authToken);
	for (var idx in sendalert.phonenumber) {
	client.messages.create({
	    'to': sendalert.phonenumber[idx],
	    'from': sendalert.fromphonenumber,
	    'body': sendalert.instance + ":" + messagebody
	}, function (err, errmsg) {
		if (err!=null) {
	    	util.winston.error('sendalert.alert:'+ JSON.stringify(err) +":" +JSON.stringify(errmsg));
		}
	});	
	}
}

module.exports = sendalert;


