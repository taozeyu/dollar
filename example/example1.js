var http = require('http');
var D = require('../');

var get$ = D.async(http, http.get);

D.start(function* (){
    console.log("ready to load...");
    var options = {
        host : 'www.douban.com',
        port : 80,
        page : '/good-good-study-day-day-up'
    };
    var res = yield get$(options);
    if(res.statusCode == 200) {
        console.log("success");
    } else {
        console.log("fail : "+res.statusCode);
    }
    console.log("complite");
});