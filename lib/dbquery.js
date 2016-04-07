/**
 * @file DBQuery
 * @description Wrapper for all database queries. It queries the staging tables and writes the counts to Firebase
 * @author Divya Mahajan
 */
'use strict';

const oracledb = require('oracledb');
const util = require('./util.js');
var moment = require('moment');
var moment_range = require('moment-range');

var config = {};
var dbquery = {};

dbquery.initialize = function(dbConfig) {
    config = {
        user: dbConfig.dbuser,
        password: dbConfig.dbpass,
        connectString: dbConfig.dbconnectstring
    };
    dbquery.check_connection();
};

/**
 * Check database logon and print errors to the console.
 */
dbquery.check_connection = function() {
    oracledb.getConnection(config,
        function(err, connection) {
            if (err) {
                console.error("dbquery:check_connection: Cannot logon to database with user:" + config.user + " and connection string:" + config.connectString);
                console.error(err.message);
                return;
            } else {
                console.info("dbquery:check_connection: Passed");
            }
            doRelease(connection);
        });
};
/**
 * Generic query function 
 * @param {String} querystring SQL statement
 * @param {Map} params Map of the bind parameters, use {} if no bind parameters are needed
 * @param {Map} options Oracle DB option parameters - see https://github.com/oracle/node-oracledb/blob/master/doc/api.md#executeoptions
 * @param {function(metadata,rows)} process_function Function to process the result set if the query was successful. Uses dump_to_console to display to console if no function is passed.
 */
dbquery.query = function(querystring, params, options, process_function) {
    oracledb.getConnection(config,
        function(err, connection) {
            if (err) {
                console.error("dbquery:query: Cannot logon to database with user:" + config.user + " and connection string:" + config.connectString);
                console.error(err.message);
                return;
            }

            connection.execute(querystring, params, options,
                function(err, result) {
                    if (err) {
                        console.error("dbquery:query: Cannot query database with query:" + querystring);
                        console.error(err.message);
                        doRelease(connection);
                        return;
                    }
                    if (typeof (process_function) == 'function') {
                        process_function(result.metaData, result.rows);
                    } else {
                        dbquery.dump_to_console(result.metaData, result.rows);
                    }
                    doRelease(connection);
                });
        });
};
/**
 * Display query results to console.
 */
dbquery.dump_to_console = function(metadata, rows) {
    console.log(JSON.stringify(result.metaData));
    console.log(JSON.stringify(result.rows));
};
/**
 * Query the staging table for service contracts
 * @param {String} tablename Database table to query
 * @param {String} object_name Name of the object in Firebase - used to update the count.
 * @param {Moment} for_moment Moment that you want to use for the query. This will query the past 5 minutes. 
 */
dbquery.query_staging_table = function(tablename, object_name, for_time) {
    var range = util.getTimeBucket(for_time);
    var zdate0 = range[0].clone().utc();
    var zdate1 = range[1].clone().utc();
    var querystring = "SELECT COUNT(*) AS ROWCOUNT FROM " + tablename
        + " WHERE LASTMODIFIEDDATE >= :fromdate "
        + " AND LASTMODIFIEDDATE <= :todate ";
    var params = {
        fromdate: { val: range[0].format('YYYY-MM-DD[T]HH:mm:ss[Z]'), dir: oracledb.BIND_IN, type: oracledb.STRING },
        todate: { val: range[1].format('YYYY-MM-DD[T]HH:mm:ss[Z]'), dir: oracledb.BIND_IN, type: oracledb.STRING }
    };
    var options = {
        /*        fetchInfo: {
                    "ROWCOUNT": { type: oracledb.DEFAULT }
                } */
    };
    console.info('query_staging_table:' + querystring + "\n\t" + JSON.stringify(params));
    dbquery.query(querystring, params, options, function(metadata, rows) {
        var count = rows[0][0];
        /*
        console.log('dbquery:querystagetable - returns :' + range[1].format('YYYY-MM-DDTHH:mm:ss'));
        console.log(metadata);
        console.log(rows);
        console.log('Count:' + count);
        */
        util.updateFirebase(range[1], object_name, count);
    });
};
dbquery.query_all_staging = function(for_time) {
    dbquery.query_staging_table('sfstage.s_servicecontract', 'WCServiceContract', for_time);
    // Add staging tables and fields for other staging tables here.
};

/**
 * Create some test data in the database
 */
// Comment this out for test data
//dbquery.create_test_data = create_test_data;

/**
function create_test_data(table, start, stop) {
    var range = moment.range(start, stop);
    var duration = moment.duration(5, 'minutes');

    oracledb.getConnection(config,
        function(err, connection) {
            if (err) {
                console.error("dbquery:query: Cannot logon to database with user:" + config.user + " and connection string:" + config.connectString);
                console.error(err.message);
                return;
            } else {
                range.by(duration, function(m) {

                    var query = "INSERT into " + table + " values ('test123',to_date('"
                        + m.format('YYYY-MM-DD HH:mm:ss') + "', 'yyyy-mm-dd hh24:mi:ss'))";
                    var t=Math.random()*10; 
                    for (var k = 0; k < t; k++) {
                        connection.execute(query,
                            function(err, result) {
                                if (err) {
                                    console.error("dbquery:query: Cannot insert into database with query:" + query);
                                    console.error(err.message);
                                } else {
                                    console.log(m.format('YYYY-MM-DD HH:mm:ss')+":1");
                                }
                            });
                    }
                });
                connection.commit(function(err){
                    console.error('Error during commit:'+err);
                })

            }

        });
}
*/

/**
 * Helper to close Oracle connection after a query.
 */
function doRelease(connection) {
    connection.release(
        function(err) {
            if (err) {
                console.error("dbquery:doRelease: Cannot release a connection" + err.message);
            }
        });
}
module.exports = dbquery;
