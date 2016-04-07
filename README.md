# subtle-delay
Node modules - to monitor an onpremise database, Salesforce instance and push the data into Firebase. The code is probably not completely re-usable, so you can use it as a sample design.
A separate web page will provide a user interface for the Firebase database.

##Logic:
 * Split the day into fixed buckets of 5 minutes.
 * Every 5 minutes query Salesforce for the changes made in the last complete 5 minute bucket. This information is pushed into Firebase.
 * Every 5 minutes query the onpremise database for the changes made in the last complete 5 minute bucket. This information is pushed into Firebase.
 * The Firebase structure uses the fixed timestamps (Date-Time) as the key for each entry with the following substructure.
``` 
    "TimeStamp": {
    }
```
 * On detecting an update to a Firebase key, the listener function will compute the delta between the count of messages from Salesforce and the count of messages received by the database.
 * To avoid timing issues and delays, we also calculate a rolling delta - where the difference is calculated over the previous two timebuckets. 
 * On the webpage, if the rolling delta is > XXXX a red indicator is shown. We need to determine how to use this to alert SAP and send text messages.
 
## Structure
1. dbconfig.js - Create this using the format belowand set all the parameters for your setup. You must require it before the main module.

```
module.exports = {
    dbuser: process.env.DBUSER,
    dbpass: process.env.DBPASS,
    dbconnectstring: process.env.DBCONNECTSTRING,
    sfdc_instance_url: process.env.SF_INSTANCEURL,
    sfdc_oauth: process.env.SF_OAUTH,
    sfdc_user: process.env.SF_USER,
    sfdc_password: process.env.SF_PASS,
    firebase_url: process.env.FB_URL,
    firebase_key: process.env.FB_KEY,
    twilio_accountSid:process.env.TWILIO_ACCOUNT_SID,
    twilio_authToken:process.env.TWILIO_AUTH_TOKEN,
    twilio_phonenumber:process.env.TWILIO_PHONE
};
```
1. util - wrapper around the Firebase standard module.
2. sfquery - Salesforce sub-module.
2. dbquery - On premise database query assuming an Oracle database.
3. deltalogic - TODO - Sub module that computes the deltas.


## Setting up a database

https://hub.docker.com/r/wnameless/oracle-xe-11g/
Using Kitematic - install the oracle-xe-11g docker image.
Run the image.
In Kitematic - click the ports for this image - to see the local port numbers.


To use the SQL Plus client, click "Exec" in Kitematic. You are logged in as root. 
```
su - oracle
sqlplus system/oracle

alter user system identified by 123;
alter user system identified by oracle;

create table s_servicecontract ( -    
  sf_id varchar2(50), -
  row_upd_dt timestamp -
  );
insert into s_servicecontract values ('123',to_date('2016-04-02 12:01:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:02:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:03:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:04:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:05:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:06:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:07:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:08:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:09:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:11:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:12:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:13:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:14:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:15:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:16:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:17:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:18:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:19:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:21:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:22:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:23:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:24:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:25:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:26:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:27:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:28:00', 'yyyy-mm-dd hh24:mi:ss'));
insert into s_servicecontract values ('123',to_date('2016-04-02 12:29:00', 'yyyy-mm-dd hh24:mi:ss'));


```
  
To use the Web client - logon to the mapped port 8080 with system/oracle. You must reset the password (shown above by alter user system) or you get password expired errors;

