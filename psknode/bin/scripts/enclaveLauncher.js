const TAG = "REMOTE-ENCLAVE-SERVER";

let path = require("path");

process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../"));
require(path.join(__dirname, '../../bundles/pskWebServer.js'));

const RemoteEnclave = require('remote-enclave');
path = require("swarmutils").path;
const fs = require('fs');

if (!process.env.REMOTE_ENCLAVE_CONFIG_LOCATION) {
    process.env.REMOTE_ENCLAVE_CONFIG_LOCATION = "./";
}

function startServer() {
    const args = process.argv;
    let options;
    let config;
    if (args.length <= 2) {
        console.log(`[${TAG}] No config file found, RemoteEnclave will start using default config`);
    }
    try {
        let fileContent;
        try {
            fileContent = fs.readFileSync(args[2]);
        }
        catch (err) {
            console.log(`[${TAG}] Could not read configuration file: ${args[2]}`);
        }

        options = JSON.parse(fileContent);
        process.env.REMOTE_ENCLAVE_DOMAIN = options.domain;
        process.env.REMOTE_ENCLAVE_SECRET = options.config.secret;
        config = options.config;
        console.log(`[${TAG}] Working directory for Remote Enclave process:  ${process.cwd()}`);
    } catch (err) {
        console.log(`[${TAG}] Config file invalid, RemoteEnclave will start using default config, err: ${err}`);
    }

    const remoteEnclaveServer = RemoteEnclave.createInstance(config);
    remoteEnclaveServer.on("initialised", (did) => {
        console.log(`[${TAG}] RemoteEnclave initialised with DID: ${did}`);
    });

    remoteEnclaveServer.on("error", (err) => {
        console.log(`[${TAG}] RemoteEnclave error: ${err}`);
    });
    remoteEnclaveServer.start();
}

startServer();
