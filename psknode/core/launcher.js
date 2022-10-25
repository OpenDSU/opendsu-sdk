//the first argument is a SEED
//the second argument is the path to a temporary working folder to be used by PSK installation
const path = require("path");
const fs = require("fs");

require("./utils/pingpongFork").enableLifeLine(1000);
let tmpDir = path.join(__dirname, "../../tmp");

if (process.argv.length >= 4) {
    tmpDir = path.resolve(process.argv[3]);
}
if (typeof process.env.PSK_TMP_WORKING_DIR === "undefined") {
    process.env.PSK_TMP_WORKING_DIR = tmpDir;
}

fs.mkdirSync(process.env.PSK_TMP_WORKING_DIR, {recursive: true});
console.log("PSK is using the tmp working dir:", process.env.PSK_TMP_WORKING_DIR);

const codeFolder = path.normalize(__dirname + "./../../");

if (!process.env.PSK_ROOT_INSTALATION_FOLDER) {
    process.env.PSK_ROOT_INSTALATION_FOLDER = codeFolder;
}

require('../bundles/pskWebServer');
require('../bundles/pskruntime');
require('../bundles/blockchain');
require('../bundles/openDSU');

//require('callflow');

const ConfigBox = require('../core/ConfigBuilder');
ConfigBox.getKeySSI((err, keySSI) => {
    if (err) {
        throw err;
    }

    process.argv.splice(2, 0, keySSI);
    require("./psknode/bundles/launcherBoot.js");
});