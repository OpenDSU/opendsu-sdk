const or = require('overwrite-require');
const env = typeof window !== "undefined" ? or.constants.BROWSER_ENVIRONMENT_TYPE : or.constants.WEB_WORKER_ENVIRONMENT_TYPE;
or.enableForEnvironment(env);

require("./iframeBoot_intermediar");
