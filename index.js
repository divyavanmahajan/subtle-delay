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
 * @return Promise
 */
monitor.initialize = function(dbconfig) {
        if (!(dbconfig===undefined)) {
            monitor.config = dbconfig;
        }
        
        //console.log(JSON.stringify(monitor.config));
        process.on('SIGINT', onCtrlC);
        monitor.util.initialize(monitor.config);
        monitor.sfquery.initialize(monitor.config);
        monitor.sendalert.initialize(monitor.config);
        return monitor.dbquery.initialize(monitor.config);
    };
   
/**
 * Polling interval. The default is 4 min and 50 seconds.
 */
monitor.pollinterval = 5 * 60 * 1000 - 10000; // Repeat after 4 minutes and 50 seconds
/**
 * The server function sets up a polling loop to keep polling the changes in Salesforce and the database.
 * See monitor.pollinterval
 */

monitor.server = function() {
    pollfunction(); // This should never exit
}

/**
 * Internal: Polling function to repeatedly query Salesforce and the database
 */

function pollfunction() {
    var timestamp = moment();
    poll(timestamp,'sfstage.s_servicecontract','ServiceContract');
    poll(timestamp,'sfstage.s_servicerole','Service_Role__c');
//    poll(timestamp,'sfstage.s_account','Account');
    setTimeout(pollfunction, monitor.pollinterval);
}

/**
 * Internal: Poll a single object and its database table
 */
function poll(timestamp,table,objectname) {
    var dbchanges;
    var sfchanges;
    monitor.dbquery.query_staging_table(table, 'DB_'+objectname,timestamp).then(function(res) {
        if (typeof(res)=="undefined") {
		console.error(moment().format()+":Error during query");
	}
	var tablename=res.tablename;
	var query = res.query;
	var metadata = res.metadata;
	var rows = res.rows;
        dbchanges = rows;
        //console.log('dbquery:query_all_staging - returns :' + tablename + ":" + rows.length);
        //console.log(metadata);
        //console.log(rows);

        monitor.sfquery.getObjectsChanged(objectname,'SF_'+objectname, timestamp, function(err,sf_object, object_name, for_time, query, result) {
            // console.log('sfquery:getObjectsChanged returns');
            sfchanges = result;
	    if (err==null) {
		//console.log('Salesforce returns : ' + result.totalSize);
		compareChanges(timestamp,dbchanges,sfchanges,sf_object);
	    } else {
		//console.log('Salesforce returns : '+ err);
		compareChanges(timestamp,dbchanges,null,sf_object);
	    }
          }
        );
    },function(err) {
        console.error(moment().format()+": Error during polling:"+JSON.stringify(err));
        console.log(moment().format()+": Error during polling:"+JSON.stringify(err));
    });
    
}

/**
 * Internal - compare array of changes from Oracle with Salesforce result set.
 */
function compareChanges(timestamp,dbchanges, sfchanges,objectname) {
    var map={};
    var missed = [];
    var sf_missed = [];
    var late = [];
    var okay = [];
    console.log(moment().format()+":"+'CompareChanges for '+objectname);

    if (sfchanges==null) {
        console.log(moment().format()+":"+'   No data from Salesforce');
    } else {
        console.log(moment().format()+":"+'   Salesforce '+sfchanges.records.length+' records for '+objectname);
        for (var i = 0; i < sfchanges.records.length; i++) {
            var record = sfchanges.records[i];
            //console.log(JSON.stringify(record));
            var timestring = moment(record.LastModifiedDate).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
            console.log(moment().format()+":"+"     "+record.Id+":"+timestring);
            map[record.Id] = record.LastModifiedDate;
        }
    }

    console.log(moment().format()+":"+'   Database '+dbchanges.length+' records for '+objectname);
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
        console.log(moment().format()+":"+'     '+sf_id+":"+db_lastmodified+"  "+db_updatedTime+"  "+latency);
        
        var value = map[sf_id];
	var fbrecord = {'sf_id':sf_id,'db_lastmodified':db_lastmodified,
                            'db_updatedTime':db_updatedTime,'latency':latency,'objectname':objectname};

	// Remove this record id+lastmodified from the missing global list
	try {
	// console.log('Missed:'+sf_id+' - '+db_lastmodified);
	var removekey="missed/"+objectname+'/'+sf_id+"/"+db_lastmodified;
	monitor.util.removeFirebaseString(removekey);
	} catch (err101) { console.log(moment().format()+":"+"   Error removing "+removekey+":"+err101);}

        if (typeof(value)=='undefined') {
            console.log(moment().format()+":"+'  Previous DB batch?: '+sf_id+":"+value);
            // Database result was is not in Salesforce query. 
            // It is probably in the previous SF query window.
        } else {
   	    sf_lastmodified = moment(value).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
	    fbrecord['sf_lastmodified']=sf_lastmodified;
	}
	if (latency > MAX_SLA_LATENCY) {
            late.push(fbrecord);
	    try {
	    monitor.util.updateFirebaseString("late/"+objectname+'/'+sf_id,db_lastmodified,latency);
	    } catch (err102) { console.log(moment().format()+":"+"   Error updating late: "+sf_id+":"+err102);}
	} else {
            
            if (sf_lastmodified> db_lastmodified) {
                console.log(moment().format()+":"+'  Multiple updates. Latest missed: '+sf_id+": Salesforce - "+sf_lastmodified+" | DB - "+lastmodifieddate);
                // This update has not come through but an earlier update came in the same window.
                sf_missed.push({'sf_id':sf_id,'sf_lastmodified':sf_lastmodified });
 		try {
		monitor.util.updateFirebaseString("missed/"+objectname+'/'+sf_id,sf_lastmodified,1);
	        } catch (err103) { console.log(moment().format()+":"+"   Error updating missed "+id+":"+err103);}
            } else {
		// okay.push({'sf_id':sf_id,'sf_lastmodified':sf_lastmodified, 'db_updatedTime':db_updatedTime,'latency':latency });
		//console.log(":::sf_id:"+sf_id+"  fbrecord:"+fbrecord.sf_id);
		okay.push(fbrecord);
 		try {
		monitor.util.updateFirebaseString("okay/"+objectname+'/'+sf_id,sf_lastmodified,latency);
	        } catch (err103) { console.log(moment().format()+":"+"   Error updating okay "+sf_id+":"+err103);}
            }
            delete map[sf_id];
        }
    }
    var id;
    for (id in map){
        // These did not come down to the database and may be waiting in the queue
        var timestring = moment(map[id]).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
        sf_missed.push({'sf_id':id,'sf_lastmodified':timestring });
 	try {
	monitor.util.updateFirebaseString("missed/"+objectname+'/'+id,timestring,1);
        } catch (err104) { console.log(moment().format()+":"+"   Error updating missed "+id+":"+err104);}
    }

    var average_latency=0;
    var range=monitor.util.getTimeBucket(timestamp);
    var timestamp = range[1].utc();
    if (okay.length>0 || late.length>0) { average_latency = total_latency / (okay.length+late.length);}
    if (late.length>0 || sf_missed.length>0) {
        var message = '   XC:'+objectname+': '+timestamp.format('MM-DD HH:mm Z')
			+'| ok:'+okay.length+" missed:"+sf_missed.length+" late:"+late.length+' latency:'+average_latency;
        monitor.sendalert.alert(message);
    }
    console.log(moment().format()+":"+'   Metrics: '+objectname+' |'+timestamp.format('YYYY-MM-DDTHH:mm:ss[Z]')
			+'| okay:'+okay.length+" missed:"+sf_missed.length+" late:"+late.length+' latency:'+average_latency);
    console.log(moment().format()+":"+'   Missed:',sf_missed);
    
    monitor.util.updateFirebase(timestamp, objectname+'_latency', average_latency);
    monitor.util.updateFirebase(timestamp, objectname+'_late', late.length);
    monitor.util.updateFirebase(timestamp, objectname+'_okay', okay.length);
    monitor.util.updateFirebase(timestamp, objectname+'_missed', sf_missed.length);
    monitor.util.updateFirebase(timestamp, objectname+'_missed_records', sf_missed);
    monitor.util.updateFirebase(timestamp, objectname+'_late_records', late);
    console.log(moment().format()+":"+'Finished compare.');

}

/**
 * Internal: Function to trap Ctrl+C and exit the process. 
 */
function onCtrlC() {
    console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");
    setTimeout(process.exit, 2000); // Wait 2 seconds and exit. This is needed for Firebase to exit.
}

module.exports = monitor;
