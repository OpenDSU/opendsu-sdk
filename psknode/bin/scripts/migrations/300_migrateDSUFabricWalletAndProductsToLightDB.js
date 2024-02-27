let path = require("path");
const process = require("process");
process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../../"));
require(path.join(__dirname, '../../../../builds/output/pskWebServer.js'));
const fs = require('fs');
path = require("swarmutils").path;
const API_HUB = require('apihub');

let config = API_HUB.getServerConfig();

const PREFIX = 'DB_';
const generateEnclaveName = (domain, subdomain) => {
    return `${PREFIX}${domain}_${subdomain}`;
}
const copySlotToSecrets = async (slot, domain, subdomain) => {
    const secretsServiceInstance = await API_HUB.getSecretsServiceInstanceAsync(config.storage);
    await secretsServiceInstance.putSecretAsync("default", generateEnclaveName(domain, subdomain), slot);
}

const migrateProductsToLightDB = async (epiEnclave, lightDBEnclave) => {
    const TABLE_NAME = "products";
    let records;
    try {
        records = await $$.promisify(epiEnclave.getAllRecords)(undefined, TABLE_NAME);
    } catch (e) {
        console.error("Failed to get records from table", TABLE_NAME, e);
        throw e;
    }

    for (let record of records) {
        record.payload = record.product;
        delete record.product;
        try {
            await $$.promisify(lightDBEnclave.insertRecord)($$.SYSTEM_IDENTIFIER, TABLE_NAME, record.pk, record);
        } catch (e) {
            console.error("Failed to insert record", record, "in table", TABLE_NAME, e);
            throw e;
        }
    }
}

const migrateBatchToLightDB = async (epiEnclave, lightDBEnclave) => {
    const TABLE_NAME = "batches";
    let records;
    try {
        records = await $$.promisify(epiEnclave.getAllRecords)(undefined, TABLE_NAME);
    } catch (e) {
        console.error("Failed to get records from table", TABLE_NAME, e);
        throw e;
    }

    for (let record of records) {
        record.payload = record.batch;
        delete record.batch;
        try {
            await $$.promisify(lightDBEnclave.insertRecord)($$.SYSTEM_IDENTIFIER, TABLE_NAME, record.pk, record);
        } catch (e) {
            console.error("Failed to insert record", record, "in table", TABLE_NAME, e);
            throw e;
        }
    }
}

const migrateLogsToLightDB = async (epiEnclave, lightDBEnclave) => {
    const TABLE_NAME = "logs";
    const NEW_TABLE_NAME = "audit";
    let records;
    try {
        records = await $$.promisify(epiEnclave.getAllRecords)(undefined, TABLE_NAME);
    } catch (e) {
        console.error("Failed to get records from table", TABLE_NAME, e);
        throw e;
    }

    for (let record of records) {
        try {
            await $$.promisify(lightDBEnclave.insertRecord)($$.SYSTEM_IDENTIFIER, NEW_TABLE_NAME, record.pk, record);
        } catch (e) {
            console.error("Failed to insert record", record, "in table", NEW_TABLE_NAME, e);
            throw e;
        }
    }

}

const migrateAccessLogsToLightDB = async (epiEnclave, lightDBEnclave) => {
    const TABLE_NAME = "login_logs";
    const NEW_TABLE_NAME = "user-access";
    let records;
    try {
        records = await $$.promisify(epiEnclave.getAllRecords)(undefined, TABLE_NAME);
    } catch (e) {
        console.error("Failed to get records from table", TABLE_NAME, e);
        throw e;
    }

    for (let record of records) {
        try {
            await $$.promisify(lightDBEnclave.insertRecord)($$.SYSTEM_IDENTIFIER, NEW_TABLE_NAME, record.pk, record);
        } catch (e) {
            console.error("Failed to insert record", record, "in table", NEW_TABLE_NAME, e);
            throw e;
        }
    }

}

const getEpiEnclave = async () => {
    const openDSU = require("opendsu");
    const enclaveAPI = openDSU.loadAPI("enclave");
    const walletDBEnclave = enclaveAPI.initialiseWalletDBEnclave(process.env.DEMIURGE_SHARED_ENCLAVE_KEY_SSI);
    await $$.promisify(walletDBEnclave.on)("initialised")
    const _enclaves = await $$.promisify(walletDBEnclave.filter)(undefined, "group_databases_table", "enclaveName == epiEnclave");
    const epiEnclave = enclaveAPI.initialiseWalletDBEnclave(_enclaves[0].enclaveKeySSI);
    await $$.promisify(epiEnclave.on)("initialised")
    return epiEnclave;
}

const getSlotFromEpiEnclave = async (epiEnclave) => {
    const privateKey = await $$.promisify(epiEnclave.getPrivateKeyForSlot)(undefined, 0);
    return privateKey;

}

const getLightDBEnclave = async () => {
    const lightDBPath = path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, config.storage, `/external-volume/lightDB/${generateEnclaveName(process.env.EPI_DOMAIN, process.env.EPI_SUBDOMAIN)}/database`);
    try {
        fs.mkdirSync(path.dirname(lightDBPath), {recursive: true});
    } catch (e) {
        // if folder exists do nothing else throw error
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
    const LokiEnclaveFacade = require("loki-enclave-facade");
    const adapters = LokiEnclaveFacade.Adaptors;
    return LokiEnclaveFacade.createLokiEnclaveFacadeInstance(lightDBPath, undefined, adapters.STRUCTURED);
}
const startServer = async () => {
    const listeningPort = Number.parseInt(config.port);
    const rootFolder = path.resolve(config.storage);
    await $$.promisify(API_HUB.createInstance)(listeningPort, rootFolder);
}

const migrateDataFromEpiEnclaveToLightDB = async () => {
    const openDSU = require("opendsu");
    const http = openDSU.loadAPI("http");
    const crypto = openDSU.loadAPI("crypto");
    const interceptor = (data, callback) => {
        let {url, headers} = data;
        if(!headers){
            headers = {};
        }
        headers["x-api-key"] = crypto.sha256JOSE(process.env.SSO_SECRETS_ENCRYPTION_KEY, "base64");
        callback(undefined, {url, headers});
    }

    http.registerInterceptor(interceptor);

    await startServer();
    const epiEnclave = await getEpiEnclave();
    const lightDBEnclave = await getLightDBEnclave();
    let slot;
    try {
        slot = await getSlotFromEpiEnclave(epiEnclave);
    } catch (err) {
        const crypto = require('opendsu').loadAPI('crypto');
        slot = crypto.generateRandom(32).toString('base64');
    }
    await copySlotToSecrets(slot, process.env.EPI_DOMAIN, process.env.EPI_SUBDOMAIN);
    await migrateProductsToLightDB(epiEnclave, lightDBEnclave);
    await migrateBatchToLightDB(epiEnclave, lightDBEnclave);
    await migrateLogsToLightDB(epiEnclave, lightDBEnclave);
    await migrateAccessLogsToLightDB(epiEnclave, lightDBEnclave);
}

module.exports = migrateDataFromEpiEnclaveToLightDB;