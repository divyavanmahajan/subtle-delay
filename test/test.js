// Author: Divya Mahajan
// Push information to the Firebase connection
var moment = require('moment');
const dbconfig=require('./dbconfig.js')
const monitor=require('../index.js');

main();

function main()
{
    monitor.initialize(dbconfig);
    monitor.server();   
    //monitor.dbquery.create_test_data('s_servicecontract',new Date(2016,03,01),new Date(2016,04,10));
}