const path = require('path');

require(path.join(__dirname, "../../bundles/testRunnerBoot"));

const argvParser = require(path.join(__dirname, "./argumentsParserUtil"));

process.processedArgv = {
    "directory": process.cwd(),
    "config": undefined
};
argvParser.populateConfig(process.processedArgv);

require(path.join(__dirname, "../../../modules/double-check/bin/testRunner"));
