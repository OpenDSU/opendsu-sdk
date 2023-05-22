require("../../../../psknode/bundles/testsRuntime");

const {workerData, parentPort} = require("worker_threads");
const Logger = require("../Logger");

const logger = new Logger("[RemoteEnclaveNodeLauncherWorkerBoot]");
async function boot() {
    const { parentPort } = require("worker_threads");

    try {
        const { rootFolder} = workerData;
        const remoteEnclave = require("remote-enclave");

        let remoteEnclaveInstance;
        const remoteEnclaveInitialised = new Promise((resolve, reject) => {
            const callback = (result) => {
                resolve(result);
            };
            remoteEnclaveInstance = remoteEnclave.createInstance({rootFolder});
            remoteEnclaveInstance.start();
            remoteEnclaveInstance.on("initialised", callback);
        });

        const remoteEnclaveDID = await remoteEnclaveInitialised;

        parentPort.postMessage(remoteEnclaveDID);
    } catch (error) {
        logger.error("Boot error", error);
    }

    process.on("uncaughtException", (error) => {
        logger.error("uncaughtException inside node worker", error);
        setTimeout(() => process.exit(1), 100);
    });
}

boot();

module.exports = boot;