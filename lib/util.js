/**
 * @file Util
 * @author Divya Mahajan
 */
'use strict';
var moment=require('moment');
var winston=require('winston');
require('winston-loggly');
var loggly=require('loggly');
var Firebase = require("firebase"); 
var FirebaseTokenGenerator = require("firebase-token-generator");
var util = {};
util.baseRef = undefined;
util.winston = winston;
/**
 * Initialize util.baseRef with the Firebase URL.
 * TODO: Authentication
 */
util.initialize = function(config) {
    winston.add(winston.transports.Loggly,config.loggly);
    util.logglyclient= loggly.createClient({
	    subdomain: config.loggly.subdomain,
	    auth: config.loggly.auth || null,
	    json: config.loggly.json || false,
	    proxy: config.loggly.proxy || null,
	    token: config.loggly.token,
	    tags: config.loggly.tags || ["xc-monitor"],
	    isBulk: config.loggly.isBulk || false
	  });
    winston.info('Monitor starting up');
    util.logglyclient.log('Hello World');
    var tokenGenerator = new FirebaseTokenGenerator(config.firebase_secret);
    var token = tokenGenerator.createToken({ uid: '1', isServer: true });
    //var token = tokenGenerator.createToken({ uid: "1", isServer: true },{ admin: true});
	// admin = true - gives full access to this firebase
    util.baseRef = new Firebase(config.firebase_url);
    util.baseRef.authWithCustomToken(token,function(err,authData) {
  	if (err) {
	    util.winston.log('error',moment().format()+":"+"Error logging into Firebase. Exiting");
	    process.exit(-1);
	} else {
	    util.winston.log('info',moment().format()+":"+"Login to Firebase succeeded");
	}
    });
    util.OAuthRef = new Firebase(config.oauthtoken_url);
    util.OAuthRef.authWithCustomToken(token,function(err,authData) {
  	if (err) {
	    util.winston.log('error',moment().format()+":Error logging into Firebase for the OAuth token. Continuing");
	} else {
	    util.winston.log('info',moment().format()+":"+"Login to Firebase for OAuth token url succeeded");
	}
    });
}
/**
 * Returns the last bucket of 5 minutes that has passed as an array.
 * @param {Moment} m Moment to use to find the bucket
 * @return {Array} [0] = Moment that is the start, [1] = Moment that is the end.
 */
util.getTimeBucket= function(m) {
    var minutes = Math.floor(m.minute() / 5) * 5;
    var m1 = m.clone();
    m1.minute(minutes).second(0);
    var m2 = m1.clone().add(-5, 'minutes');
    return [m2, m1];
}

/**
 * Update bucket with a timestamp key
 * @param {Moment} timestamp Timestamp to use as the key for this entry
 * @param {String} object_name Field/Objectname to update in Firebase
 * @param {any} value Value to update in Firebase. Should be an integer or undefined
 */
util.updateFirebase = function(timestamp,object_name,value) {
    var utc = timestamp.clone().utc();
    var key = utc.format("YYYY-MM-DDTHH:mm:ss");
    var tsRef = util.baseRef.child(key);
    var updateMsg = {};
    updateMsg[object_name]=value;
    tsRef.update(updateMsg);    
    //util.winston.log('debug',moment().format()+":"+'   Firebase_util:'+key+":"+object_name+":"+value);
}

/**
 * Update bucket with a string key
 * @param {String} keystring String to use as the key for this entry
 * @param {String} object_name Field/Objectname to update in Firebase
 * @param {any} value Value to update in Firebase. Should be an integer or undefined
 */
util.updateFirebaseString = function(keystring,object_name,value) {
    var tsRef = util.baseRef.child(keystring);
    var updateMsg = {};
    updateMsg[object_name]=value;
    tsRef.update(updateMsg);    
    //util.winston.log('debug',moment().format()+":"+'   Firebase_util:'+keystring+":"+object_name+":"+value);
}

/**
 * Remove Firebase key
 * @param {String} keystring String to use as the key for this entry
 */
util.removeFirebaseString = function(keystring) {
    var tsRef = util.baseRef.child(keystring);
    tsRef.remove().then(function() {
	    // util.winston.log('debug',moment().format()+":"+'   Firebase_util:remove'+keystring);
    });
}

module.exports = util;
