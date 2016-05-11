// Author: Divya Mahajan
// Check each missed entry in Firebase and cross check it against Oracle
var moment = require('moment');
const dbconfig=require('./dbconfig.js')
const monitor=require('../index.js');
var util=monitor.util;
var dbquery=monitor.dbquery;

main();

function main()
{
    monitor.initialize(dbconfig).then(check,function(err) {
	console.log(moment()+":"+JSON.stringify(err));   
    });
}

function update()
{
  var missedRef=util.baseRef.child('missed').child('ServiceContract');
  var t=require('./m3.js');
	console.log("T",JSON.stringify(t));
  t.map(function(rec,i) {
	var rec=t[i];
	console.log(JSON.stringify(rec));
	// Check if it is there
	
	var ref=missedRef.child(rec.sf_id).child(rec.sf_lastmodified);
	var refu=missedRef.child(rec.sf_id).child('undefined');
	ref.once('value',function(snap) {
		if (snap.exists()) {
			ref.set(1).then(function(){
				console.log(ref.toString());
				console.log(rec.sf_id,rec.sf_lastmodified,"1");
				return refu.remove();
			}).then(function() {
				console.log(refu.toString(),"cleared");

			}).then(null,function(err) {
				console.error(rec.sf_id,rec.sf_lastmodified,err);
			});
		}
	});
  });
}
function check()
{
  var missedRef=util.baseRef.child('missed').child('ServiceContract');
  missedRef.on("child_added",function(dataSnapshot,prevChildKey) {
    if (dataSnapshot.exists()) {
	
	missedRef.child(dataSnapshot.key()).once('value', function(snapshot) {
		var sf_id=snapshot.key();
		console.log(moment().format()+":Missed Contract.",sf_id,JSON.stringify(snapshot.val())); 
		dbquery.query_staging_table_single('sfstage.s_servicecontract', 'DB_ServiceContract', sf_id).then(function(res) {
			if (typeof(res)=="undefined") {
				console.error(moment().format()+":Error during query");
			}
			var tablename=res.tablename;
			var query = res.query;
			var metadata = res.metadata;
			var rows = res.rows;
			var dbchanges = rows;
			var lastmodifieddate = dbchanges[0][1];
			var timepart=lastmodifieddate.substring(0,19);
			console.log(sf_id,lastmodifieddate,timepart);
			for(var k in snapshot.val()) {
				k = k.substring(0,19);
				if (k=="undefined" || k <= timepart)
				{
					console.log('  ',k,' is equal or older');
					if (k=="undefined") {
						if (timepart>'2016-05-11') missedRef.child(sf_id).remove();
					} else {
						missedRef.child(sf_id).child(k+'Z').remove();
					}
				} else {
					console.log('  ',k,' more recent');
				}
			}
		});
	});
    }
  });
}
