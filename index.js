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
        monitor.sfquery.querySFChanges(timestamp, function(sf_object, object_name, for_time, query, result) {
            sfchanges = result;
            if (sf_object == 'ServiceContract') {
                console.log('Salesforce returns : ' + result.totalSize);
                compareChanges(timestamp,dbchanges,sfchanges);
            }
        });
    });
    
    // TODO: Compare SFChanges and DBChanges

    setTimeout(pollfunction, monitor.pollinterval);
}

/**
 * Internal - compare array of changes from Oracle with Salesforce result set.
 */
function compareChanges(timestamp,dbchanges, sfchanges) {
    var map={};
    var missed = [];
    var late = [];
    var okay = [];
    console.log('CompareChanges');

    console.log('   Salesforce records');
    for (var i = 0; i < sfchanges.records.length; i++) {
        var record = sfchanges.records[i];
        //console.log(JSON.stringify(record));
        map[record.Id] = record.LastModifiedDate;
        console.log("     "+record.Id+":"+record.LastModifiedDate);
    }
    console.log('   Database records');
    for (var j=0;j<dbchanges.length;j++) {
        console.log('     '+dbchanges[j][0]+":"+dbchanges[j][1]+":"+dbchanges[j][2]);
        var key = dbchanges[j][0];

        var lastmodifieddate = dbchanges[j][1];
        var updatedTime = dbchanges[j][2];
        
        var value = map[key];
        if (typeof(value)=='undefined') {
            console.log('  Late: '+key+":"+value);
            // Database has an update not in salesforce. 
            // Possible cause: Late update - This could be a previous batch that was updated now.
            late.push({'data':dbchanges[j]}); // Push the entire row
        } else {
            var sf_lastmodified = moment(value).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
            var db_lastmodified = moment(lastmodifieddate).utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
            var db_updatedTime = moment(updatedTime).format('YYYY-MM-DDTHH:mm:ss[Z]');

            if (sf_lastmodified!=db_lastmodified) {
                console.log('  Missed: '+key+":"+sf_lastmodified+"/"+lastmodifieddate);
                // This update did not come through.
                missed.push({'key':key,'sf_lastmodified':sf_lastmodified,'db_lastmodified':db_lastmodified,
                            'db_updatedTime':db_updatedTime });
            } else {
                /// NATHANIEL: To calculate transit - db_updatedTime - db_lastmodified.
                // Look up Momentjs.com to figure out deltas.
                var transit = -1;
                okay.push({'key':key,'sf_lastmodified':sf_lastmodified,
                            'db_updatedTime':db_updatedTime,'transit':transit });
                // ALERTING????
            }
        }
    }
    console.log('   Metrics: okay:'+okay.length+" missed:"+missed.length+" late:"+late.length);        
    console.log('   Late:'+JSON.stringify(late));
    console.log('   Okay:'+JSON.stringify(okay));
    console.log('   Missed:'+JSON.stringify(missed));
    var range=monitor.util.getTimeBucket(timestamp);
    var key = range[1].utc();
    console.log('   Updating Firebase:'+key.format('YYYY-MM-DDTHH:mm:ss[Z]'));
    
    monitor.util.updateFirebase(key, 'ServiceContract_okay', okay.length);
    monitor.util.updateFirebase(key, 'ServiceContract_late', late.length);
    monitor.util.updateFirebase(key, 'ServiceContract_missed', missed.length);
    monitor.util.updateFirebase(key, 'ServiceContract_late_records', late);
    monitor.util.updateFirebase(key, 'ServiceContract_missed_records', missed);
    monitor.util.updateFirebase(key, 'ServiceContract_okay_records', okay);
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
