const Logger = require("../Logger");
const logger = new Logger("[CloudEnclaveTestNodeLauncherWorkerBoot]");

async function createRemoteEnclaveInstanceAsync(options) {
    process.env.CLOUD_ENCLAVE_SECRET = options.secret;
    const cloudEnclave = require("cloud-enclave");
    logger.info("Starting Remote Enclave instance...", options);
    const remoteEnclaveInstance = cloudEnclave.createInstance(options);
    remoteEnclaveInstance.start();
    return new Promise((resolve, reject) => {
        remoteEnclaveInstance.on("initialised", (result) => {
            resolve(result);
        });
    });
}

async function createRemoteEnclaveInstanceWorkerAsync(options) {
    logger.info("Starting remote enclave worker instance...", options);
    const { spawn } = require('node:child_process');

    return new Promise((resolve, reject) => {
        process.env.CLOUD_ENCLAVE_SECRET = options.secret;
        process.env.CLOUD_ENCLAVE_CONFIG = JSON.stringify(options);

        const newProcess = spawn("node", ["./opendsu-sdk/psknode/tests/util/RemoteEnclaveTestNodeLauncher/RemoteEnclaveTestNodeLauncherWorkerBoot.js"], {
            env: process.env,
        });
        newProcess.stdout.on("data", (data) => {
            const stringifiedData = data.toString();
            if(stringifiedData.split(":")[0]!=="DID"){
                console.log(stringifiedData);
            }
            else{
                resolve(stringifiedData.substring(4));
            }

        });
        newProcess.on("error", (err) => {
            logger.error("The remote enclave worker has encountered an error", err);
            reject(err);
        });
    });
}

function RemoteEnclaveTestNodeLauncher(config) {
    this.launch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchAsync()
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchAsync = async () => {
        process.env.CLOUD_ENCLAVE_DOMAIN = config.domain;
        const remoteEnclaveNodeDID = config.useWorker
            ? await createRemoteEnclaveInstanceWorkerAsync(config)
            : await createRemoteEnclaveInstanceAsync(config);

        return remoteEnclaveNodeDID;
    };
}

module.exports = RemoteEnclaveTestNodeLauncher;
