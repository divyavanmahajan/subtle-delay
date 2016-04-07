/**
 * @file send alert
 * @sends an SMS with alert information via Twilio
 * @author Nathaniel Taylor
 */

// Twilio Credentials 

var twilio = require('twilio');
var sendalert={};

var client;

sendalert.initialize=function(config) {
	sendalert.accountSid = config.twilio_accountSid;
	sendalert.authToken = config.twilio_authToken;
	sendalert.phonenumber = config.twilio_phonenumber;
}
//require the Twilio module and create a REST client

sendalert.alert=function(to,messagebody) {
	var	client = twilio(sendalert.accountSid, sendalert.authToken);
	client.messages.create({
	    'to': to,
	    'from': sendalert.phonenumber,
	    'body': messagebody
	}, function (err, errmsg) {
		if (err!=null) {
	    	console.log('sendalert.alert:'+ JSON.stringify(err) +":" +JSON.stringify(errmsg));
		}
	});	
}

module.exports = sendalert;


