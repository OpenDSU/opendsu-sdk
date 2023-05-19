const TAG = "REMOTE-ENCLAVE-SERVER";

let path = require("path");

process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../"));
require(path.join(__dirname, '../../bundles/pskWebServer.js'));

const RemoteEnclave = require('remote-enclave');
path = require("swarmutils").path;
const fs = require('fs');

if(!process.env.REMOTE_ENCLAVE_CONFIG_LOCATION) {
    process.env.REMOTE_ENCLAVE_CONFIG_LOCATION = "./";
}

function startServer() {
    const configFilePath = path.join(process.env.REMOTE_ENCLAVE_CONFIG_LOCATION, 'remote-enclave.json');
    let config = undefined;
    try {
        config = JSON.parse(fs.readFileSync(configFilePath));
    } catch (e) {
        console.log(`[${TAG}] No config file found, RemoteEnclave will start using default config`);
    }

    const remoteEnclaveServer = RemoteEnclave.createInstance(config);
    remoteEnclaveServer.on("initialised", (did)=>{
        console.log(`[${TAG}] RemoteEnclave initialised with DID: ${did}`);
    });

    remoteEnclaveServer.on("error", (err) => {
        console.log(`[${TAG}] RemoteEnclave error: ${err}`);
    });
    remoteEnclaveServer.start();
}

startServer();
