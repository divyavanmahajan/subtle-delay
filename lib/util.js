/**
 * @file Util
 * @author Divya Mahajan
 */
'use strict';
var Firebase = require("firebase"); 

var util = {};
util.baseRef = undefined;

/**
 * Initialize util.baseRef with the Firebase URL.
 * TODO: Authentication
 */
util.initialize = function(config) {
    util.baseRef = new Firebase(config.firebase_url);
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
    console.log('   Firebase_util:'+key+":"+object_name+":"+value);
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
    console.log('   Firebase_util:'+keystring+":"+object_name+":"+value);
}

/**
 * Remove Firebase key
 * @param {String} keystring String to use as the key for this entry
 */
util.removeFirebaseString = function(keystring) {
    var tsRef = util.baseRef.child(keystring);
    tsRef.remove().then(function() {
	    console.log('   Firebase_util:remove'+keystring);
    });
}

module.exports = util;
