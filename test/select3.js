//# Test the query for SFStage
var oracledb = require('oracledb');
var dbConfig = require('./dbconfig.js');

oracledb.getConnection(
  {
    user          : 'system',
    password      : 'oracle',
    connectString : '192.168.99.100:32769/xe'
  },
  function(err, connection)
  {
    if (err) {
      console.error(err.message);
      return;
    }
    connection.execute(
      "SELECT COUNT(*) FROM s_servicecontract " 
	+ "WHERE row_upd_dt > To_date('19-MAR-2016')",
      function(err, result)
      {
        if (err) {
          console.error(err.message);
          doRelease(connection);
          return;
        }
        console.log(result.metaData);
        console.log(result.rows);
        doRelease(connection);
      });
  });

function doRelease(connection)
{
  connection.release(
    function(err) {
      if (err) {
        console.error(err.message);
      }
    });
}

