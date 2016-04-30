/**
 * @file Index
 * @author Divya Mahajan / Nathaniel Taylor
 */
'use strict';

//var EventEmitter = require('events').EventEmitter;
var monitor = {};
var moment = require('moment');

monitor.config=require('./lib/config.js');
monitor.util=require('./lib/util.js');
monitor.sfquery=require('./lib/sfquery.js');
monitor.dbquery=require('./lib/dbquery.js');
monitor.sendalert=require('./lib/sendalert.js');

/**
 * Setup the configuration for the program usernames, passwords etc.
 * This will initialize the module and must be called before using the other functions.
 * 
 * @param {Map} dbconfig configuration for the module.
 */
monitor.initialize = function(dbconfig) {
        if (!(dbconfig===undefined)) {
            monitor.config = dbconfig;
        }
        
        //console.log(JSON.stringify(monitor.config));
        process.on('SIGINT', onCtrlC);
        monitor.util.initialize(monitor.config);
        monitor.sfquery.initialize(monitor.config);
        monitor.dbquery.initialize(monitor.config);
        monitor.sendalert.initialize(monitor.config);
    };
   
/**
 * The server function sets up a polling loop to keep polling the changes in Salesforce and the database.
 * See monitor.pollinterval
 */

monitor.server = function() {
    pollfunction(); // This should never exit
}
/**
 * Polling interval. The default is 4 min and 50 seconds.
 */
monitor.pollinterval = 5 * 60 * 1000 - 10000; // Repeat after 4 minutes and 50 seconds

/**
 * Internal: Polling function to repeatedly query Salesforce and the database
 */
function pollfunction() {
    var timestamp = moment();
    var dbchanges;
    var sfchanges;
    monitor.dbquery.query_all_staging(timestamp, function(tablename,query,metadata, rows) {
        dbchanges = rows;
        console.log('dbquery:query_all_staging - returns :' + tablename + ":" + rows.length);
        //console.log(metadata);
        //console.log(rows);
        monitor.sfquery.querySFChanges(timestamp, function(err,sf_object, object_name, for_time, query, result) {
            sfchanges = result;
            if (sf_object == 'ServiceContract') {
		if (err==null) {
			console.log('Salesforce returns : ' + result.totalSize);
			compareChanges(timestamp,dbchanges,sfchanges);
		} else {
			console.log('Salesforce returns : '+ err);
			compareChanges(timestamp,dbchanges,null);
		}
            }
        });
    });
    
    setTimeout(pollfunction, monitor.pollinterval);
}

/**
 * Internal - compare array of changes from Oracle with Salesforce result set.
 */
function compareChanges(timestamp,dbchanges, sfchanges) {
    var map={};
    var missed = [];
    var sf_missed = [];
    var late = [];
    var okay = [];
    console.log('CompareChanges');

    console.log('   Salesforce records');
    if (sfchanges==null) {
        console.log('     No data from Salesforce');
    } else {
        for (var i = 0; i < sfchanges.records.length; i++) {
            var record = sfchanges.records[i];
            //console.log(JSON.stringify(record));
            map[record.Id] = record.LastModifiedDate;
            var timestring = moment(record.LastModifiedDate).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
            console.log("     "+record.Id+":"+timestring);
        }
    }

    console.log('   Database records');
    var total_latency = 0;
    for (var j=0;j<dbchanges.length;j++) {
        var sf_id = dbchanges[j][0];

        var lastmodifieddate = dbchanges[j][1];
        var updatedTime = dbchanges[j][2];
	var sf_date  = moment(lastmodifieddate).utc()
	var db_date = moment(updatedTime).utc();
        var sf_lastmodified = sf_date.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
        var db_lastmodified = sf_date.format('YYYY-MM-DDTHH:mm:ss[Z]');
        var db_updatedTime = db_date.format('YYYY-MM-DDTHH:mm:ss[Z]');
	var latency = (db_date.toDate() - sf_date.toDate())/1000;
		total_latency = total_latency + latency;
	var MAX_SLA_LATENCY=300; // 300s = 5 minutes
        console.log('     '+sf_id+":"+db_lastmodified+"  "+db_updatedTime+"  "+latency);
        
        var value = map[sf_id];
	var fbrecord = {'sf_id':sf_id,'db_lastmodified':db_lastmodified,
                            'db_updatedTime':db_updatedTime,'latency':latency };

	// Remove this record id+lastmodified from the missing global list
	try {
	console.log('Missed:'+sf_id+' - '+db_lastmodified);
	var removekey="missed/"+sf_id+"/"+db_lastmodified;
	monitor.util.removeFirebaseString(removekey);
	} catch (err101) { console.log("   Error removing "+removekey+":"+err101);}

        if (typeof(value)=='undefined') {
            console.log('  Previous DB batch?: '+sf_id+":"+value);
            // Database result was is not in Salesforce query. 
            // It is probably in the previous SF query window.
        } else {
   	    sf_lastmodified = moment(value).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
	    fbrecord['sf_lastmodified']=sf_lastmodified;
	}
	if (latency > MAX_SLA_LATENCY) {
            late.push(fbrecord);
	    try {
	    monitor.util.updateFirebaseString("late/"+sf_id,db_lastmodified,latency);
	    } catch (err102) { console.log("   Error updating late: "+sf_id+":"+err102);}
	} else {
            
            if (sf_lastmodified> db_lastmodified) {
                console.log('  Multiple updates. Latest missed: '+sf_id+": Salesforce - "+sf_lastmodified+" | DB - "+lastmodifieddate);
                // This update has not come through but an earlier update came in the same window.
                sf_missed.push({'sf_id':id,'sf_lastmodified':sf_lastmodified });
 		try {
		monitor.util.updateFirebaseString("missed/"+id,sf_lastmodified,1);
	        } catch (err103) { console.log("   Error updating missed "+id+":"+err103);}
            } else {
		// okay.push({'sf_id':sf_id,'sf_lastmodified':sf_lastmodified, 'db_updatedTime':db_updatedTime,'latency':latency });
		okay.push(fbrecord);
 		try {
		monitor.util.updateFirebaseString("okay/"+id,sf_lastmodified,latency);
	        } catch (err103) { console.log("   Error updating missed "+id+":"+err103);}
            }
            delete map[sf_id];
        }
    }
    var id;
    for (id in map){
        // These did not come down to the database and may be waiting in the queue
        var sf_lastmodified = map[id];
        sf_missed.push({'sf_id':id,'sf_lastmodified':sf_lastmodified });
 	try {
	monitor.util.updateFirebaseString("missed/"+id,sf_lastmodified,1);
        } catch (err104) { console.log("   Error updating missed "+id+":"+err104);}
    }

    var average_latency=0;
    var range=monitor.util.getTimeBucket(timestamp);
    var timestamp = range[1].utc();
    if (okay.length>0) { average_latency = total_latency / okay.length;}
    if (late.length>0 || sf_missed.length>0) {
        var message = '   XC: '+timestamp.format('YYYY-MM-DDTHH:mm:ss[Z]')
			+'| ok:'+okay.length+" missed:"+sf_missed.length+" late:"+late.length+' latency:'+average_latency;
        monitor.sendalert.alert('+19785049454',message);
        monitor.sendalert.alert('+14253810688',message);
    }
    console.log('   Updating Firebase:'+timestamp.format('YYYY-MM-DDTHH:mm:ss[Z]'));
    console.log('   Metrics: |'+timestamp.format('YYYY-MM-DDTHH:mm:ss[Z]')
			+'| okay:'+okay.length+" missed:"+sf_missed.length+" late:"+late.length+' latency:'+average_latency);
    console.log('   Late:'+JSON.stringify(late));
    console.log('   Missed:'+JSON.stringify(sf_missed));
    
    monitor.util.updateFirebase(timestamp, 'ServiceContract_latency', average_latency);
    monitor.util.updateFirebase(timestamp, 'ServiceContract_late', late.length);
    monitor.util.updateFirebase(timestamp, 'ServiceContract_okay', okay.length);
    monitor.util.updateFirebase(timestamp, 'ServiceContract_missed', sf_missed.length);
    monitor.util.updateFirebase(timestamp, 'ServiceContract_missed_records', sf_missed);
    monitor.util.updateFirebase(timestamp, 'ServiceContract_late_records', late);
    console.log('Finished compare.');

}

/**
 * Internal: Function to trap Ctrl+C and exit the process. 
 */
function onCtrlC() {
    console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");
    setTimeout(process.exit, 2000); // Wait 2 seconds and exit. This is needed for Firebase to exit.
}

module.exports = monitor;
