var http = require('http');
var D = require('../');

var ID = 0;

var get$ = D.wrapper(function(complite, args){
    var options = args[0];
    http.get(options, function(res) {
        console.log('get http://'+options.host+':'+options.port + options.page);
        complite(ID++);
    });
});

D.start(function* (){
    console.log("ready to load...");
    var options = {
        host : 'www.douban.com',
        port : 80,
        page : '/'
    };
    var rs = yield [get$(options), get$(options), get$(options), get$(options)];
    
    console.log("complite "+rs);
});