/**
 * Initialize Salesforce connection
 */
const jsforce = require('jsforce');
const util = require('./util.js');
var moment = require('moment');


var conn;
var config = {};
var sfquery = {};

/**
 * Query Salesforce to get the metrics.
 * @param {Moment} timestamp Time to use for the query
 */
sfquery.querySFChanges = function(timestamp,process_function) {
    getObjectsChanged('Contact', 'Contact', timestamp);
    getObjectsChanged('Case', 'Case', timestamp);
    getObjectsChanged('ServiceContract', 'ServiceContract', timestamp,process_function);
}

/**
 * Internal: Create the SOQL query for changes in a given timestamp range
 * @param {String} sf_object Salesforce internal object name for SOQL
 * @param {Array of Moments} range range[0] = start timestamp, range[1] = end timestamp
 * @returns {String} SOQL query
 */
function getQuery(sf_object, range) {
    var lower = range[0].utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    var upper = range[1].utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    var query = 'select Id, LastModifiedDate from ' + sf_object
        + ' where LastModifiedDate >= ' + lower
        + ' and LastModifiedDate <= ' + upper;
    return query;
    //util.winston.debug(query);
}

/**
 * Internal: Query Salesforce and write the total count to Firebase
 * @param {string} query SOQL query to use.
 * @param {string} Object/Firebase field name_field
 * @param {Moment} for_time the time to use for the query.
 * @param {function} process_function - process_function(err,sf_object, object_name, for_time, query, result) callback.
 */


function getObjectsChanged(sf_object, object_name, for_time, process_function) {
    var range = util.getTimeBucket(for_time);

    var q = getQuery(sf_object, range);
    // util.winston.debug('getObjectsChanged:SOQL query:' + q );

    conn.query(q, function(err, result) {
        if (err) {
            util.winston.error(moment().format()+':getObjectsChanged:Error in SF query:' + q + ': ' + err);
            util.updateFirebase(range[1], object_name, -1);
            process_function(err,sf_object, object_name, for_time, q);
        } else {
            // util.winston.debug('getObjectsChange: Response');
            //util.winston.debug(JSON.stringify(result));
            var count = result.totalSize;
            //util.winston.debug('SF changes - ' + object_name + ":" + count);
            util.updateFirebase(range[1], object_name, count);
            if (typeof (process_function) == 'function') {
                process_function(null,sf_object, object_name, for_time, q, result);
            } 
        }
    });
}
sfquery.getObjectsChanged=getObjectsChanged;




/**
 * Internal: Use OAuth2 token as access token for logon. So the session is already created and no logon is needed.
 * This is the default initialize.
 */
sfquery.OAuth2_login = function(dbconfig) {
    config = dbconfig;
    conn = new jsforce.Connection(
        {
            instanceUrl: config.sfdc_instance_url,
            accessToken: config.sfdc_oauth
        }
    );
    setupListener();
    //util.winston.debug(conn);
};
sfquery.initialize = sfquery.OAuth2_login;
// Firebase listener for OAuth Token
//
function setupListener() {
  util.OAuthRef.on("value",function(dataSnapshot) {
	if (dataSnapshot.exists()) {
	    util.winston.info(moment().format()+":OAuth token changed in Firebase.");// ,dataSnapshot.val());	
	    config.sfdc_oauth=dataSnapshot.val();
	    conn = new jsforce.Connection(
		{
		    instanceUrl: config.sfdc_instance_url,
		    accessToken: config.sfdc_oauth
		});
	}
  });
}
//
/**
 * Internal: Use SF username and password - to create a new session and logon.
 * Not tested. This is the alternative initialize
 */
sfquery.UserId_login = function(dbconfig) {
    config = dbconfig;

    conn = new jsforce.Connection({
        // you can change loginUrl to connect to sandbox or prerelease env.
        loginUrl: config.sfdc_instance_url
    });
    conn.login(config.sfdc_user, config.sfdc_password, function(err, userInfo) {
        if (err) { return util.winston.error(moment().format()+":"+err); }
        // Now you can get the access token and instance URL information.
        // Save them to establish connection next time.
        util.winston.info(conn.accessToken);
        util.winston.info(conn.instanceUrl);
        // logged in user property
        util.winston.info("User ID: " + userInfo.id);
        util.winston.info("Org ID: " + userInfo.organizationId);
    });
};


module.exports = sfquery;
