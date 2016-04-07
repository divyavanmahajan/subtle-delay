
var messagesRef = new Firebase('https://intense-torch-3200.firebaseio.com/xcmonitoring/nt');
var querydate=moment();
var querydatetext="";
var historyStats={};
var refreshSeconds = 300;
var intervalMinutes = 5; // 5 Minutes 
document.getElementById("queryBtn").addEventListener("click", function () {
    var soql = document.getElementById("soql");
    var result = document.getElementById("result");
    force.query(soql.value,
        function (data) {
            result.innerHTML = JSON.stringify(data, undefined, 3);
        },
        function (error) {
            alert("Error: " + JSON.stringify(error));
        });
}, false);

document.getElementById("refreshBtn").addEventListener("click", refreshData, false);
document.getElementById("loginBtn").addEventListener("click", login, false);

function showToken() {
    try {
        var tokentext = document.getElementById("oauth-token");
        tokentext.innerHTML = JSON.stringify(force.oauthStore());
        //console.log("Token:" + force.oauthStore());
        
    } catch (e) {
        console.error(e);
    }
}
function showDate() {
    try {
        var datetext = document.getElementById("datestamp");
        datetext.innerHTML =  querydate.format("dddd, MMMM Do YYYY, h:mm:ss a"); ;
    } catch (e) {
        console.error(e);
    }
}
// Need two named areas
// <object_name>_summary (h2)
// <object_name>_changed (h2)
// <object_name>_table (tbody)
function getObjectsChanged(object_name,name_field) {
    var date = querydate;
    
    var query = 'select Id,'+name_field+', LastModifiedBy.Name, LastModifiedDate from '+
                object_name+' where LastModifiedDate > '+date.format()+' ORDER BY LastModifiedDate DESC limit 200';
    var soql = document.getElementById("soql");
    soql.innerHTML = query;
    

    force.query(query, function (response) {
        var str = '';
        for (var i = 0; i < response.records.length; i++) {
            str += '<tr>' +
            '<td>' + i + '</td>' +
            '<td>' + response.records[i].Id + '</td>' +
            '<td>' + response.records[i][name_field] + '</td>' +
            '<td>' + response.records[i].LastModifiedBy.Name + '</td>' +
            '<td>' + response.records[i].LastModifiedDate + '</td>' +
            '</tr>';
        }
        document.getElementById(object_name+'_table').innerHTML = str;
    });

    var changed = document.getElementById(object_name+"_changed");
    var changed2 = document.getElementById(object_name+"_summary");
    var query2 = 'select COUNT() from '+object_name+' where LastModifiedDate > '+date.format();
    var tsRef = messagesRef.child(querydatetext);
    var updateMsg = {};
    updateMsg[object_name]=-1;
    tsRef.update(updateMsg);    
    force.query(query2, function (response) {
        try {
            // console.log("Count succeeded.");
            historyStats[querydatetext][object_name]=response.totalSize;
            updateMsg[object_name]=response.totalSize;
            tsRef.update(updateMsg);
            // console.info(updateMsg);  
            if (changed!=null) {
                changed.innerHTML = response.totalSize +' '+ object_name+ " changes.";            
            }
            if (changed2!=null) {
                changed2.innerHTML = response.totalSize +' '+ object_name+ " changes.";            
            }
        } catch(e) {
            console.error(e);
        }
    },function(err) {
        historyStats[querydatetext][object_name]=-1;
    });       

    //get changes in SFSTAGE - for now just make it a random number until the funciton is ready to query it

    var wcchange = Math.floor((Math.random() * 10) + 1);
    //console.log(wcchange);
    var tsRef2 = messagesRef.child(querydatetext);
    tsRef2.set({'WCServiceContract':wcchange});


}

//Get changed objects from wecare and put in firebase

function sfstagechanged() {
//    var date = querydate;



}

function refreshData() {
    querydate=moment().subtract(intervalMinutes,'m');
    try {
        querydatetext = querydate.toISOString();// "2016-03-19T03:50:55.591Z"
        querydatetext = querydatetext.replace(/.[0-9][0-9][0-9]Z/,"Z"); // Strip out microseconds
    } catch(e) {
        console.error('No toISOString() '+e);
    }
    historyStats[querydatetext]={'Contact':-1,'Case':-1,'ServiceContract':-1};
    var tsRef = messagesRef.child(querydatetext);
    tsRef.set({'Contact':-1,'Case':-1,'ServiceContract':-1,'WCContact':-1,'WCServiceContract':-1,'WCCase':-1,'Delta':-1}); 
    showDate();
    showToken();

    //call fucntion to get changes from SFDC and update firebase

    getObjectsChanged('Contact','Name');
    getObjectsChanged('Case','CaseNumber');
    getObjectsChanged('ServiceContract','ContractNumber');

    //call function to get counts from SFSTAGE

    sfstagechanged();

}
function autoRefreshData() {
    refreshData();
    setTimeout(autoRefreshData,refreshSeconds*1000); // Refresh after 5 minute;
}

function keys(obj)
{
    var keys = [];

    for(var key in obj)
    {
        if(obj.hasOwnProperty(key))
        {
            keys.push(key);
        }
    }

    return keys;
}
// Display history table
function showHistory() {
    var timestamps = keys(historyStats).sort(function(a,b) { return b.localeCompare(a); });
    var str = '';
    var i=timestamps.length;
    timestamps.forEach(function(stamp) {
        str += '<tr>' +
            '<td>' + i + '</td>' +
            '<td>' + stamp + '</td>' +
            '<td>' + historyStats[stamp]['Contact'] + '</td>' +
            '<td>' + historyStats[stamp]['Case'] + '</td>' +
            '<td>' + historyStats[stamp]['ServiceContract'] + '</td>' +
            '</tr>';
        i = i - 1
        
    }, this);
    document.getElementById('history_table').innerHTML = str;

}
var savedrows = {};
function showFirebaseHistory(snapshot) {
    //GET DATA
    var stamp = snapshot.key();
    var data = snapshot.val();
    // console.info(JSON.stringify(data));
    var deltacalc = Math.abs(data['ServiceContract'] - data['WCServiceContract']);
    // evaluate delta
    var indicator = "?";
    //console.log(stamp);
    var startdate = moment(stamp).format('hh:mm');
    var enddate = moment(stamp).add(intervalMinutes,'m').format('hh:mm');
    if (deltacalc == 0) {
        var indicator = "bgcolor='#008000'";
        }
        else if (deltacalc > -4 && deltacalc < 4) {
        var indicator = "bgcolor='#FFFF00'";
        }
        else {
        var indicator = "bgcolor='#FF0000'";
        }

    var columns =
            '<td>' + startdate + '</td>' +
            '<td>' + enddate + '</td>' +
            '<td>' + data['ServiceContract'] + '</td>' +
            '<td>' + data['WCServiceContract'] + '</td>' +
            '<td>' + deltacalc + '</td>' +
            '<td ' + indicator + '></td>';

    
    // Using JQuery to add a row to the table
    var row = savedrows[stamp];
    //console.info('1'+"#"+stamp);
    if (!row)
    {
        var str = "<tr/>";
        row=$(str);
        row.html(columns);
        var tblbody = $('#firebase_table');
        tblbody.prepend(row);
        savedrows[stamp]=row;
        //console.info('2');
    } else {
        //console.info('3');
        row.html(columns);
        
    }
    
}

function removeFirebaseHistory(snapshot)
{
    //GET DATA
    var stamp = snapshot.key();
    var data = snapshot.val();
    //console.info('remove - '+stamp);
    var row = savedrows[stamp];
    if (row) {
        savedrows[stamp]=undefined;
        row.remove();
    }
}

function autoShowHistory()
{
    showHistory();
    setTimeout(autoShowHistory,15*1000); // Refresh after 15 secs;
}
    
function login() {
    force.login(autoRefreshData);
    autoShowHistory();
}
if (window.location.hostname=='salty-gorge-66919.herokuapp.com') {
    force.init({appId: '3MVG9KI2HHAq33RzNHP6WHwVK23pR4J56AZuDEZQ9iAIIyAyKjAcom.Lg48fFwojC1YYZ9s00Dw4Ava.3leLi'});
    // This uses a different OAuth app that is setup for salty-gorge-66919.herokuapp.com    
}
// login();
function calculateChanges(snapshot) {
    // Logic here
    // Do I have all he values
    // Calculate delta
    // update delta - only if it is different - to avoid loops
    var stamp = snapshot.key();
    var data = snapshot.val();
    showFirebaseHistory(snapshot);
}

var query = messagesRef.limitToLast(20);
query.on('child_added',showFirebaseHistory);
query.on('child_changed',calculateChanges);
query.on('child_removed',removeFirebaseHistory);

