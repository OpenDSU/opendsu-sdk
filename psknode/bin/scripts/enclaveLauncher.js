const TAG = "CLOUD-ENCLAVE";

let path = require("path");
const process = require("process");
process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../"));
require(path.join(__dirname, '../../../builds/output/pskWebServer.js'));

const CloudEnclave = require('cloud-enclave');

path = require("swarmutils").path;
const API_HUB = require('apihub');

if (!process.env.PSK_ROOT_INSTALATION_FOLDER) {
    process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve("." + __dirname + "/../..");
}

if (!process.env.PSK_CONFIG_LOCATION) {
    process.env.PSK_CONFIG_LOCATION = "./conf";
}
let config = API_HUB.getServerConfig();

function startServer() {
    const args = process.argv;
    if (args.length <= 2) {
        console.log(`[${TAG}] No config file found, CloudEnclave will start using default config`);
    }

    path = require("path");
    let conf = {};
    conf.configLocation = path.join(process.env.PSK_CONFIG_LOCATION, "cloud-enclaves");
    conf.rootFolder = path.join(config.storage, "external-volume", "cloud-enclaves");
    const remoteEnclaveServer = CloudEnclave.createInstance(conf);
    remoteEnclaveServer.on("initialised", (did) => {
        console.log(`[${TAG}] CloudEnclave initialised with DID: ${did}`);
    });

    remoteEnclaveServer.on("error", (err) => {
        console.log(`[${TAG}] CloudEnclave error: ${err}`);
    });
    remoteEnclaveServer.start();
}

startServer();
