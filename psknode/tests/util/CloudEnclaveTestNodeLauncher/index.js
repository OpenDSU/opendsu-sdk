const Logger = require("../Logger");
const logger = new Logger("[CloudEnclaveTestNodeLauncherWorkerBoot]");

async function createCloudEnclaveInstanceAsync(options) {
    process.env.CLOUD_ENCLAVE_SECRET = options.secret;
    const cloudEnclave = require("cloud-enclave");
    logger.info("Starting Cloud Enclave instance...", options);
    const cloudEnclaveInstance = cloudEnclave.createInstance(options);
    cloudEnclaveInstance.start();
    return new Promise((resolve) => {
        cloudEnclaveInstance.on("initialised", (result) => {
            resolve(result);
        });
    });
}

async function createCloudEnclaveInstanceWorkerAsync(options) {
    logger.info("Starting cloud enclave worker instance...", options);
    const {spawn} = require('node:child_process');

    return new Promise((resolve, reject) => {
        process.env.CLOUD_ENCLAVE_SECRET = options.secret;
        process.env.CLOUD_ENCLAVE_CONFIG = JSON.stringify(options);

        const newProcess = spawn("node", ["./opendsu-sdk/psknode/tests/util/CloudEnclaveTestNodeLauncher/CloudEnclaveTestNodeLauncherWorkerBoot.js"], {
            env: process.env,
        });
        newProcess.stdout.on("data", (data) => {
            const stringifiedData = data.toString();
            if (stringifiedData.split(":")[0] !== "DID") {
                console.log(stringifiedData);
            } else {
                resolve(stringifiedData.substring(4));
            }

        });
        newProcess.on("error", (err) => {
            logger.error("The cloud enclave worker has encountered an error", err);
            reject(err);
        });
    });
}

function CloudEnclaveTestNodeLauncher(config) {
    this.launch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchAsync()
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchAsync = async () => {
        process.env.CLOUD_ENCLAVE_DOMAIN = config.domain;
        const cloudEnclaveNodeDID = config.useWorker
            ? await createCloudEnclaveInstanceWorkerAsync(config)
            : await createCloudEnclaveInstanceAsync(config);

        return cloudEnclaveNodeDID;
    };
}

module.exports = CloudEnclaveTestNodeLauncher;
