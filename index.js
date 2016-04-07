/**
 * @file Index
 * @author Divya Mahajan
 */
'use strict';

//var EventEmitter = require('events').EventEmitter;
var monitor = {};
var moment=require('moment');

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

monitor.server=function()
{
    pollfunction(); // This should never exit
}
/**
 * Polling interval. The default is 4 min and 50 seconds.
 */
monitor.pollinterval = 5*60*1000-10000; // Repeat after 4 minutes and 50 seconds

/**
 * Internal: Polling function to repeatedly query Salesforce and the database
 */
function pollfunction() {
    var timestamp = moment();
    monitor.dbquery.query_all_staging(timestamp);
    monitor.sfquery.querySFChanges(timestamp);  
    setTimeout(pollfunction,monitor.pollinterval); 
}

/**
 * Internal: Function to trap Ctrl+C and exit the process. 
 */
function onCtrlC() {
    console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");
    setTimeout(process.exit,2000); // Wait 2 seconds and exit. This is needed for Firebase to exit.
}

module.exports = monitor;
