const or = require('overwrite-require');
or.enableForEnvironment(or.constants.NODEJS_ENVIRONMENT_TYPE);
$$.debug.verbosity("debug");
require("./testsRuntime_intermediar");
require("double-check");