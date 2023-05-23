const {Worker} = require("worker_threads");
const path = require("path");
const Logger = require("../Logger");
const logger = new Logger("[RemoteEnclaveTestNodeLauncherWorkerBoot]");

async function createRemoteEnclaveInstanceAsync(options) {
    const remoteEnclave = require("remote-enclave");
    logger.info("Starting Remote Enclave instance...", options);
    const remoteEnclaveInstance = remoteEnclave.createInstance(options);
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
        const {useWorker, apihubPort, domain} = options;
        const bdnsAPI = require("opendsu").loadApi("bdns");
        const defaultBdns = {}
        const apihubURL = `http://localhost:${apihubPort}`;
        defaultBdns[domain] = {};
        defaultBdns[domain].anchoringServices = [apihubURL];
        defaultBdns[domain].brickStorages = [apihubURL];
        if (options.bdns) {
            bdnsAPI.setBDNSHosts(options.bdns);
        } else {
            bdnsAPI.setBDNSHosts(defaultBdns);
        }

        process.env.REMOTE_ENCLAVE_DOMAIN = domain;
        const remoteEnclaveNodeDID = useWorker
            ? await createRemoteEnclaveInstanceWorkerAsync(options)
            : await createRemoteEnclaveInstanceAsync(options);

        return remoteEnclaveNodeDID;
    };
}

module.exports = RemoteEnclaveTestNodeLauncher;
