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
    monitor.dbquery.query_all_staging(timestamp, function(metadata, rows) {
        dbchanges = rows;
    });
    monitor.sfquery.querySFChanges(timestamp, function(sf_object, object_name, for_time, query, result) {
        sfchanges = result;
        if (sf_object == 'ServiceContract') {
            console.log('Salesforce returns : ' + query);
            console.log(JSON.stringify(result));
            for (var i = 0; i < records.length; i++) {
                var record = records[i];
                console.log(JSON.stringify(record));
            }
        }
    });
    // TODO: Compare SFChanges and DBChanges

    setTimeout(pollfunction, monitor.pollinterval);
}

/**
 * Internal - compare array of changes from Oracle with Salesforce result set.
 */
function compareChanges(dbchanges, sfchanges) {
    var map={};
    var missed = [];
    var late = [];
    var okay = [];
    
    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        console.log(JSON.stringify(record));
        map[record.Id] = record.LastModifiedDate;
    }
    for (var j=0;j<dbchanges.length;j++) {
        var key = dbchanges[j][0];
        var lastmodifieddate = dbchanges[j][1];
        var value = map[key];
        if (typeof(value)=='undefined') {
            // Database has an update not in salesforce. 
            // Possible cause: Late update - This could be a previous batch that was updated now.
            late.push({'data':dbchanges[j]}); // Push the entire row
        } else {
            if (value!=lastmodifieddate) {
                // This update did not come through.
                missed.push({'key':key,'timestamp':value});
            } else {
                okay.push({'key':key,'timestamp':value,'data':dbchanges[j]});
            }
        }
        console.log('okay:'+okay.length+" missed:"+missed.length+" late:"+late.length);        
    }
    
}

/**
 * Internal: Function to trap Ctrl+C and exit the process. 
 */
function onCtrlC() {
    console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");
    setTimeout(process.exit, 2000); // Wait 2 seconds and exit. This is needed for Firebase to exit.
}

module.exports = monitor;
