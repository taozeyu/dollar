var http = require('http');
var D = require('../');

var get$ = D.wrapper(function(complite, args){
    var options = args[0];
    http.get(options, function(res) {
        console.log('get http://'+options.host+':'+options.port + options.page);
        complite();
    });
});

D.start(function* (){
    console.log("ready to load...");
    var options = {
        host : 'www.douban.com',
        port : 80,
        page : '/'
    };
    yield get$(options);
    
    console.log("complite");
});