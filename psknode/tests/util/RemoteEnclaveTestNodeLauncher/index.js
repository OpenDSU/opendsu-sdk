const {Worker} = require("worker_threads");
const path = require("path");
const Logger = require("../Logger");
const logger = new Logger("[RemoteEnclaveTestNodeLauncherWorkerBoot]");
async function createRemoteEnclaveInstanceAsync(...args) {
    const remoteEnclave = require("remote-enclave");
    logger.info("Starting Remote Enclave instance...", args);
    const remoteEnclaveInstance = remoteEnclave.createInstance(...args);
    remoteEnclaveInstance.start();
    return new Promise((resolve, reject) => {
        remoteEnclaveInstance.on("initialised", (result) => {
            resolve(result);
        });
    });
}

async function createRemoteEnclaveInstanceWorkerAsync(options) {
    logger.info("Starting remote enclave worker instance...", options);
    const {Worker} = require("worker_threads");

    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, "./RemoteEnclaveTestNodeLauncherWorkerBoot.js"), {
            workerData: options,
        });
        worker.on("message", (result) => {
            resolve(result);
        });
        worker.on("error", (err) => {
            logger.error("The remote enclave worker has encountered an error", err);
            reject(err);
        });
    });
}


function RemoteEnclaveTestNodeLauncher(options) {
    logger.info("Using the following options for launcher", options);

    this.launch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchAsync()
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchAsync = async () => {
        const {useWorker} = options;

        const remoteEnclaveNodeDID = useWorker
            ? await createRemoteEnclaveInstanceWorkerAsync(options)
            : await createRemoteEnclaveInstanceAsync(options);

        return remoteEnclaveNodeDID;
    };
}

module.exports = RemoteEnclaveTestNodeLauncher;
