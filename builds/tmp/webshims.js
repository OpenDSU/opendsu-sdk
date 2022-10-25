if (typeof(window) !== "undefined") {
    if (typeof(global) !== "undefined") {
        global = window;
    }else
    {
        window.global = window;
    }
}

if (typeof(global.$$) == "undefined") {
    global.$$ = {};
    $$.requireBundle = function () {
    };
}
const or = require('overwrite-require');
let allowedEnvTypes = [or.constants.BROWSER_ENVIRONMENT_TYPE, or.constants.SERVICE_WORKER_ENVIRONMENT_TYPE];

//there are scenarios where webshims are loaded after other bundle (eg. swboot.js) and there is no need to set envType just check
if(typeof $$.environmentType === "undefined"){
    or.enableForEnvironment(or.constants.BROWSER_ENVIRONMENT_TYPE);
}else{
    if(allowedEnvTypes.indexOf($$.environmentType) === -1){
        console.log(`Webshims bundle should be loaded only in ${JSON.stringify(allowedEnvTypes)}. Currently env type is: ${$$.environmentType}`);
    }
}

if (typeof($$.__runtimeModules) == "undefined") {
    $$.__runtimeModules = {};
}
require("./webshims_intermediar");