if(typeof $$ === "undefined" || !$$.environmentType) {
    const or = require('overwrite-require');
    or.enableForEnvironment(or.constants.NODEJS_ENVIRONMENT_TYPE);
} else {
    console.log('Test environment detected!');
}

require("./apiHub_intermediar");