const path = require("path");
const process = require("process");
process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../../"));
require(path.join(__dirname, '../../../../builds/output/pskWebServer.js'));
const fs = require('fs');
const API_HUB = require('apihub');
const openDSU = require("opendsu");

let config = API_HUB.getServerConfig();

const PREFIX = 'DB_';
const generateEnclaveName = (domain, subdomain) => `${PREFIX}${domain}_${subdomain}`;

const copySlotToSecrets = async (slot, domain, subdomain) => {
    const secretsServiceInstance = await API_HUB.getSecretsServiceInstanceAsync(config.storage);
    await secretsServiceInstance.putSecretAsync("default", generateEnclaveName(domain, subdomain), slot);
}

// Generalized migration function
const migrateDataToLightDB = async (epiEnclave, lightDBEnclave, sourceTableName, targetTableName, transformRecord = record => record, generatePK = record => record.pk) => {
    let records;
    try {
        records = await $$.promisify(epiEnclave.getAllRecords)(undefined, sourceTableName);
    } catch (e) {
        console.error("Failed to get records from table", sourceTableName, e);
        throw e;
    }

    for (let record of records) {
        const transformedRecord = transformRecord(record);
        try {
            await $$.promisify(lightDBEnclave.insertRecord)($$.SYSTEM_IDENTIFIER, targetTableName, generatePK(record), transformedRecord);
        } catch (e) {
            console.error("Failed to insert record", transformedRecord, "in table", targetTableName, e);
            throw e;
        }
    }
};

const getEpiEnclave = async () => {
    const enclaveAPI = openDSU.loadAPI("enclave");
    const walletDBEnclave = enclaveAPI.initialiseWalletDBEnclave(process.env.DEMIURGE_SHARED_ENCLAVE_KEY_SSI);
    await $$.promisify(walletDBEnclave.on)("initialised");
    const _enclaves = await $$.promisify(walletDBEnclave.filter)(undefined, "group_databases_table", "enclaveName == epiEnclave");
    const epiEnclave = enclaveAPI.initialiseWalletDBEnclave(_enclaves[0].enclaveKeySSI);
    await $$.promisify(epiEnclave.on)("initialised");
    console.log($$.promisify(epiEnclave.getAllTableNames)(undefined));
    return epiEnclave;
}

const getSlotFromEpiEnclave = async (epiEnclave) => {
    const privateKey = await $$.promisify(epiEnclave.getPrivateKeyForSlot)(undefined, 0);
    return privateKey;
}

const getLightDBEnclave = async () => {
    const lightDBPath = path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, config.storage, `/external-volume/lightDB/${generateEnclaveName(process.env.EPI_DOMAIN, process.env.EPI_SUBDOMAIN)}/database`);
    try {
        fs.mkdirSync(path.dirname(lightDBPath), { recursive: true });
    } catch (e) {
        if (e.code !== "EEXIST") throw e;
    }
    const LokiEnclaveFacade = require("loki-enclave-facade");
    const adapters = LokiEnclaveFacade.Adaptors;
    return LokiEnclaveFacade.createLokiEnclaveFacadeInstance(lightDBPath, undefined, adapters.STRUCTURED);
}

const startServer = async () => {
    const listeningPort = Number.parseInt(config.port);
    const rootFolder = path.resolve(config.storage);
    return API_HUB.createInstance(listeningPort, rootFolder);
}

const migrateDataFromEpiEnclaveToLightDB = async () => {
    const server = await startServer();
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

    // Define transformations for specific tables
    const transformProduct = record => {
        delete record.pk;
        record.productCode = record.gtin;
        record.inventedName= record.name;
        record.nameMedicinalProduct = record.description;
        return record;
    };

    const generateProductPk = record => record.gtin;
    const transformBatch = record => {
        delete record.pk;
        record.inventedName = record.productName;
        record.nameMedicinalProduct = record.productDescription;
        record.productCode = record.gtin;
        record.expiryDate = record.expiry;
        return record;
    }

    const generateBatchPk = record => {
        return `${record.gtin}_${record.batchNumber}`;
    }
    const noTransform = record => record;

    // Use the generalized migration function for different tables with appropriate transformations
    await migrateDataToLightDB(epiEnclave, lightDBEnclave, "products", "products", transformProduct, generateProductPk);
    await migrateDataToLightDB(epiEnclave, lightDBEnclave, "batches", "batches", transformBatch, generateBatchPk);
    await migrateDataToLightDB(epiEnclave, lightDBEnclave, "logs", "audit", noTransform);
    await migrateDataToLightDB(epiEnclave, lightDBEnclave, "login_logs", "user-actions", noTransform);
    await migrateDataToLightDB(epiEnclave, lightDBEnclave, "path-keyssi-private-keys", "path-keyssi-private-keys", noTransform);

    server.close();
}

module.exports = migrateDataFromEpiEnclaveToLightDB;