require("../../../../builds/output/testsRuntime");

const Logger = require("../Logger");

const logger = new Logger("[RemoteEnclaveNodeLauncherWorkerBoot]");

async function boot() {

    try {
        const remoteEnclave = require("");

        let remoteEnclaveInstance;
        const remoteEnclaveInitialised = new Promise((resolve) => {
            const callback = (result) => {
                resolve(result);
            };
            remoteEnclaveInstance = remoteEnclave.createInstance(JSON.parse(process.env.CLOUD_ENCLAVE_CONFIG));
            remoteEnclaveInstance.start();
            remoteEnclaveInstance.on("initialised", callback);
        });

        const remoteEnclaveDID = await remoteEnclaveInitialised;

        process.stdout.write("DID:" + remoteEnclaveDID);
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