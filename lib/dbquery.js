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
var connectionpool;

dbquery.initialize = function(dbConfig) {
    config = {
        user: dbConfig.dbuser,
        password: dbConfig.dbpass,
        connectString: dbConfig.dbconnectstring
    };
    var promise=new Promise(function (fulfil, reject) {
	    oracledb.createPool(config,function(err,pool) {
		if(err) {
			console.error(moment().format()+":dbquery:check_connection: Cannot create connection pool to database with user:" + config.user + " and connection string:" + config.connectString);
			console.error(moment().format()+":"+err.message);
			process.exit(-1);
			return;
		}
		connectionpool=pool;
		connectionpool.getConnection(
		  function(err, connection) {
		    if (err) {
			console.error(moment().format()+":dbquery:check_connection: Cannot logon to database with user:" + config.user + " and connection string:" + config.connectString);
			console.error(moment().format()+":"+err.message);
			process.exit(-1);
			return;
		    } else {
			console.info("dbquery:check_connection: Passed");
		        doRelease(connection).then(function() {
			    fulfil();
			});
 		    }
		});
	    });
    });
    return promise;
};
/**
 * Generic query function 
 * @param {String} querystring SQL statement
 * @param {Map} params Map of the bind parameters, use {} if no bind parameters are needed
 * @param {Map} options Oracle DB option parameters - see https://github.com/oracle/node-oracledb/blob/master/doc/api.md#executeoptions
 * @return Promise
 * {function(querystring,metadata,rows)} Promise callback to process the result set if the query was successful. 
 * Use dump_to_console to display to console if no function is available.
 */
dbquery.query = function(querystring, params, options ) {
    var promise = new Promise(function(f,r) { 		
    if (typeof(connectionpool)=="undefined") {
        console.log(moment().format()+":db_query: Connection pool is not ready.");
        r({message:"Connection pool is not ready"});
    } else {
        //console.log(moment().format()+":db_query: Connection pool is ready.");
    }
    connectionpool.getConnection(
        function(err, connection) {
            if (err) {
                console.error("dbquery:query: Cannot logon to database with user:" + config.user + " and connection string:" + config.connectString);
                console.error(err.message);
		r(err);
                return;
            }
            //console.log(moment().format()+":db_query: Querying");

            connection.execute(querystring, params, options,
                function(err, result) {
                    //console.log(moment().format()+":db_query: Query results");
                    if (err) {
                        console.error(moment().format()+":dbquery:query: Cannot query database with query:" + querystring);
                        console.error(err.message);
                        doRelease(connection).then(function() { 
				r(err);
			},r);
                        return;
                    }
                    //dbquery.dump_to_console(querystring,result.metaData, result.rows);
                    doRelease(connection).then(function() { 
                        //console.log(moment().format()+":db_query: Release");
try{
                        f({"query":querystring,"metadata":result.metaData, "rows":result.rows});
} catch(err1) {r(err1);}
                        //console.log(moment().format()+":db_query: Release done");
		    },r);
                });
        });
    });
    return promise;
};
/**
 * Display query results to console.
 */
dbquery.dump_to_console = function(querystring,metadata, rows) {
    console.log(JSON.stringify(result.metaData));
    console.log(JSON.stringify(result.rows));
};
/**
 * Query the staging table for service contracts
 * @param {String} tablename Database table to query
 * @param {String} object_name Name of the object in Firebase - used to update the count.
 * @param {Moment} for_moment Moment that you want to use for the query. This will query the past 5 minutes. 
 * @param {function(query,metadata,rows)} process_function callback to process the data.
 * @return Promise
 */
dbquery.query_staging_table = function(tablename, object_name, for_time) {
    //console.log('dbquery:query_staging_table - for :' + tablename + ":" ,for_time.format());
    var range = util.getTimeBucket(for_time);
    var zdate0 = range[0].clone().utc();
    var zdate1 = range[1].clone().utc();
    var querystring = "SELECT SFDCID,LASTMODIFIEDDATE,ROW_UPD_DT AS ROWCOUNT "
        + " " 
        + " FROM " + tablename
        + " WHERE ROW_UPD_DT >= to_timestamp_tz(:fromdate, 'YYYY-MM-DD\"t\"HH24:MI:SS.FF7TZR') "
        + " AND ROW_UPD_DT <= to_timestamp_tz(:todate, 'YYYY-MM-DD\"t\"HH24:MI:SS.FF7TZR') ";
    var params = {
        fromdate: { val: zdate0.format('YYYY-MM-DD[T]HH:mm:ss[Z]'), dir: oracledb.BIND_IN, type: oracledb.STRING },
        todate: { val: zdate1.format('YYYY-MM-DD[T]HH:mm:ss[Z]'), dir: oracledb.BIND_IN, type: oracledb.STRING }
    };
    var options = {
        /*        fetchInfo: {
                    "ROWCOUNT": { type: oracledb.DEFAULT }
                } */
    };
    //console.info('query_staging_table:' + querystring + "\n\t" + JSON.stringify(params));
    var promise=dbquery.query(querystring, params, options);
    return promise.then(
      function(res) {
	var query=res.query;
	var metadata=res.metadata;
	var rows=res.rows;
	//console.log(moment().format()+":db_query: Process results "+JSON.stringify(rows));
        var count = rows.length;
	//console.log(moment().format()+":db_query: Process results "+count);
        util.updateFirebase(range[1], object_name, count);
	//console.log(moment().format()+":db_query: returning from promise");
        return {"tablename":tablename, "query":query, "metadata":metadata, "rows":rows};
    },function(err) {
        console.error(moment().format()+": Error during query:"+JSON.stringify(err));
        console.log(moment().format()+": Error during query:"+JSON.stringify(err));
    });
};
dbquery.query_all_staging = function(for_time) {
    return dbquery.query_staging_table('sfstage.s_servicecontract', 'WCServiceContract', for_time);
    // Add staging tables and fields for other staging tables here.
};



/**
 * Helper to close Oracle connection after a query.
 */
function doRelease(connection) {
    return new Promise(function(fulfill,reject) {
    connection.release(
        function(err) {
            if (err) {
                console.error(moment().format()+":dbquery:doRelease: Cannot release a connection" + err.message);
                console.log(moment().format()+":  dbquery:doRelease: Cannot release a connection" + err.message);
		reject(err);
            }
	    fulfill();
        });
    });
}
module.exports = dbquery;
