var http = require('http');
var D = require('../');

var get$ = D.async(http, http.get);

var getStateCode$ = D(function* (host){
    var options = {
        host : host,
        port : 80,
        page : '/good-good-study-day-day-up'
    };
    var res = yield get$(options);
    console.log("get code:"+res.statusCode);
    return res.statusCode;
});

D.start(function* (){
    console.log("ready to load...");
    console.log("status code :"+(yield getStateCode$("www.baidu.com")));
    console.log("status code :"+(yield getStateCode$("www.douban.com")));
    console.log("status code :"+(yield getStateCode$("taozeyu.com")));
    console.log("done");
});