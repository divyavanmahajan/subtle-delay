// Author: Divya Mahajan
// Push information to the Firebase connection
var moment = require('moment');
const dbconfig=require('./dbconfig.js')
const monitor=require('../index.js');

main();

function main()
{
    monitor.initialize(dbconfig).then(monitor.server,function(err) {
	console.log(moment()+":"+JSON.stringify(err));   
    });
}
