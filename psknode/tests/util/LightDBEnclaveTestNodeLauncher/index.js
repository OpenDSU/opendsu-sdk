const Logger = require("../Logger");
const process = require("process");
const path = require("path");
const logger = new Logger("[LightDBEnclaveTestNodeLauncherWorkerBoot]");

async function startLightDBInstance(config) {
    if (!process.env.LIGHT_DB_SERVER_ADDRESS) {
        const lightDBPort = process.env.LIGHT_DB_PORT || 8081;
        const {createLightDBServerInstance} = require("loki-enclave-facade");
        const storage = process.env.LIGHT_DB_STORAGE || config.lightDBStorage || path.join(config.rootFolder, "external-volume/lightDB");
        config.lightDBStorage = storage;
        config.lightDBPort = lightDBPort;
        return new Promise((resolve, reject) => {
            createLightDBServerInstance(config, (err) => {
                if (err) {
                    logger.error(`Failed to start LightDB instance`);
                    return reject(err);
                }

                resolve();
            });
        });
    }
}

function LightDBEnclaveTestNodeLauncher(config) {
    this.launch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchAsync()
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchAsync = async () => {
        await startLightDBInstance(config);
    };
}

module.exports = LightDBEnclaveTestNodeLauncher;
