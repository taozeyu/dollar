module.exports = dollarFunction;
module.exports.async = asyncFunction;
module.exports.wrapper = wrapperFunction;
module.exports.catcher = creatCatcher;
module.exports.start = start;
module exports.exception = exception;

module.exports.a = asyncFunction;
module.exports.w = wrapperFunction;
module.exports.c = creatCatcher;
module.exports.s = start;
module.exports.e = exception;

function exception(obj) {
    if(obj && obj.constructor == ErrorNode) {
        throw obj.err;
    }
    return obj;
};

function wrapperFunction(wrapper) {
    return function() {
        var node = new SyncNode(null);
        var args = [];
        for(var i=0; i<arguments.length; ++i) {
            args[i] = arguments[i];
        }
        wrapper(function(){ 
            node.onSuccess.apply(node, arguments);
        }, args);
        return node;
    };
}

function asyncFunction(target, fun, index) {
    
    if(index === undefined && (fun instanceof Number)) {
        index = fun;
        fun = target;
        target = undefined;
    }
    
    if(fun === undefined && index === undefined) {
        fun = target;
        target = undefined;
    }
    
    if(index === undefined) {
        index = -1;
    }
    
    var invoker = wrapperFunction(function(success, args){
        if(index >=0 ) {
            args.splice(index, 0, success);
        } else {
            args.splice(args.length + index + 1, 0, success);
        };
        if(target===undefined) {
            target = this; //some time user will write ' fun$.apply(obj, args);'.
        }
        fun.apply(target, args);
    });
    invoker.invoke = invoker;
    invoker.i = invoker;
    
    return invoker;
}

function dollarFunction(target, generator) {
    if(!generator) {
        generator = target;
        target = null;
    }
    return platformInvoker(target, generator);
}

function start(params) {
    return creatCatcher(params).invoke();
}

function creatCatcher(params) {
    
    if(params instanceof Function) {
        params = { mainGenerator : params };
    }
    
    var mainGenerator = params.mainGenerator,
        successHandle = params.successHandle,
        errorHandle = params.errorHandle;
    
    if(errorHandle === undefined) {
        errorHandle = function(err){
            console.error(err);
        };
    }
    
    var invoke = function() {
        
        var main$ = dollarFunction(mainGenerator)
            _arguments = arguments;
        
        var rootMainFun = function*() {
            try {
                var res = yield main$.apply(null, _arguments);
                
                if(res && res.constructor == ErrorNode) {
                    if(errorHandle) {
                        errorHandle(res.err);
                    }
                } else {
                    if(successHandle) {
                        successHandle(res);
                    }
                }
            } catch(err) {
                if(errorHandle) {
                    errorHandle(err);
                }
            }
        };
        
        var gen = rootMainFun.apply(null, arguments);
        var runtime = new PlatformRuntime(gen);
        var res = createDependentsTree(gen, runtime);
        
        if(res instanceof ErrorNode) {
            if(errorHandle) {
                errorHandle(res.err);
            }
        } else if(res instanceof SyncNode) {
            if(res.parentRuntime) {
                res.parentRuntime._setCatcher(this);
            }
            res.runtime = {
                onSuccess : function(node, args, index) { },
                onError : function(err) {
                    if(errorHandle) {
                        errorHandle(errNode.err);
                    }
                },
            };
        } else {
            if(successHandle) {
                successHandle(res);
            }
        }
    };
    invoke.invoke = invoke;
    invoke.call = invoke;
    
    return invoke;
}

function SyncNode(parentRuntime) {
    
    this.parentRuntime = parentRuntime;
    this._hasCallback = false;
    this._hasFinish = false;
    
    this.listeners = function(runtime, index) {
        this.runtime = runtime;
        this.index = index;
    };
    
    this.onSuccess = function() {
        if(this._hasCallback) {
            return;
        }
        this._successArgs = arguments;
        
        if(this._isTreeComplited()) {
            this._finish();
        }
        this._hasCallback = true;
    };
    this.onError = function(err) {
        if(this._hasCallback) {
            return;
        }
        this._error = err;
        
        if(this._isTreeComplited()) {
            this._finish();
        }
        this._hasCallback = true;
    };
    this.onTreeComplited = function() {
        
        if(this._hasCallback && !this._hasFinish) {
            this._finish();
        }
    }
    this._isTreeComplited = function(){
        return this.runtime && this.runtime.catcher ;
    };
    this._finish = function() {
        this._hasFinish = true;
        if(this._error) {
            this.runtime.onError(this._error);
        } else {
            this.runtime.onSuccess(this, this._successArgs, this.index);
        }
    };
};

function ErrorNode(err, runtime) {
    this.err = err
    this.stack = [];
    
    if(runtime) {
        this.stack.push(runtime);
    }
}

function PlatformRuntime(gen) {

    this.catcher = null;
    this.syncNode = new SyncNode(this);
    
    this.gen = gen;
    
    this.needUnpack = undefined;
    this.results = undefined;
    this.waitNodes = undefined;
    this.waitCount = 0;
    
    this.onSuccess = function(node, args, index) {
        var res = (args.length > 1)? args: args[0],
            rsobj;
        this.results[index] = res;
        this.waitCount--;
        
        if(this.waitCount > 0) {
            return;
        }
        res = this.needUnpack ? this.results[0] : this.results;
        
        rsobj = gotoNextSync(this.gen, this, res);
        
        if(rsobj.done) {
            this.syncNode.onSuccess(rsobj.results);
        } else {
            bindRuntime(this, rsobj);
            this.compliteTree();
        }
    };
    this.onError = function(err) {
        this.syncNode.onSuccess(new ErrorNode(err, this));
    };
    this.compliteTree = function() {
        this._setCatcher(this.catcher);
    };
    this._setCatcher = function(catcher) {
        this.catcher = catcher;
        for(var i=0; i<this.waitNodes.length; ++i) {
            if(this.waitNodes[i].parentRuntime) {
                this.waitNodes[i].parentRuntime._setCatcher(catcher);
            };
            this.waitNodes[i].onTreeComplited();
        }
    };
};

function platformInvoker(target, generator) {

    return function(){
        var gen = generator.apply(target, arguments);
        var runtime = new PlatformRuntime(gen);
        return createDependentsTree(gen, runtime);
    };
};

function gotoNextSync(gen, runtime, lastResult) {

    var syncResults,
        syncIndex,
        res;
    
    while(true) {
        var hasSyncNode = false,
            next = null;
        
        try{
            next = gen.next(lastResult);}
        catch (err) {
            next = {done : true, value : new ErrorNode(err, this)};
        }
        res = next.value;
        if(next.done){
            if(isNormalResult(res)) {
                return {done : true, results : res}; // include ErrorNode.
            } else {
                try{
                    throw "can't return SyncNode."
                } catch(err) {
                    return {done : true, results : new ErrorNode(err, runtime)};
                }
            }
            return {done : true, results : res};
        }
        
        
        var needUnpack = true;
        
        syncResults = [];
        syncIndex = [];
        
        if(res instanceof Array) {
            for(var i in res) {
                if(isNormalResult(res[i])) {
                    if(res[i] instanceof ErrorNode) {
                        res[i].stack.push(runtime);
                         return {done : true, results : res[i]};
                    }
                } else {
                    hasSyncNode = true;
                    syncResults.push(res[i]);
                    syncIndex.push(i);
                }
            }
            needUnpack = false;
            
        } else if(isNormalResult(res)) {
            if(res instanceof ErrorNode) {
                res.stack.push(runtime);
                 return {done : true, results : res};
            }
            res = [res];
        } else {
            hasSyncNode = true;
            syncResults.push(res);
            syncIndex.push(0);
            res = [res];
        }
        
        if(hasSyncNode) {
            return {
                done: false,
                syncResults : syncResults,
                syncIndex : syncIndex,
                needUnpack : needUnpack,
                results : res,
                needUnpack : needUnpack,
            };
        }
        lastResult = needUnpack ? res[0] : res;
    }
}

function bindRuntime(runtime, rsobj) {

    var syncResults = rsobj.syncResults,
        syncIndex = rsobj.syncIndex,
        results = rsobj.results;
    
    runtime.waitCount = 0;
    runtime.waitNodes = [];
    runtime.results = results;
    runtime.needUnpack = rsobj.needUnpack;
    
    for(i=0; i<syncResults.length; ++i) {
        results[syncIndex[i]] = null;
        syncResults[i].listeners(runtime, syncIndex[i]);
        runtime.waitNodes.push(syncResults[i]);
        runtime.waitCount++;
    }
};


function createDependentsTree(gen, runtime) {
    
    var rsobj = gotoNextSync(gen, runtime);
    
    if(rsobj.done) {
        return rsobj.results;
    } else {
        bindRuntime(runtime, rsobj);
        return runtime.syncNode;
    }
}

function isNormalResult(rs) {
    return !(rs instanceof SyncNode);
}