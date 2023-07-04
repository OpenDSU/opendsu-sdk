const Logger = require("../Logger");
const logger = new Logger("[RemoteEnclaveTestNodeLauncherWorkerBoot]");

async function createRemoteEnclaveInstanceAsync(options) {
    process.env.CLOUD_ENCLAVE_SECRET = options.secret;
    const remoteEnclave = require("");
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


function RemoteEnclaveTestNodeLauncher(options) {
    logger.info("Using the following options for launcher", options);

    this.launch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchAsync()
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchAsync = async () => {
        const {useWorker, apihubPort, domain, config} = options;
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

        process.env.CLOUD_ENCLAVE_DOMAIN = domain;
        const remoteEnclaveNodeDID = useWorker
            ? await createRemoteEnclaveInstanceWorkerAsync(config)
            : await createRemoteEnclaveInstanceAsync(config);

        return remoteEnclaveNodeDID;
    };
}

module.exports = RemoteEnclaveTestNodeLauncher;
