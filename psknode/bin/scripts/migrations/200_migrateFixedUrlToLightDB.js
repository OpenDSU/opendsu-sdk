const LokiEnclaveFacade = require("loki-enclave-facade");
const apihubModule = require("apihub");
require("opendsu")
const adapters = LokiEnclaveFacade.Adaptors;
const path = require('path');
const fs = require('fs');
const apihubRootFolder = apihubModule.getServerConfig().storage;
const FIXED_URLS_PATH = path.join(apihubRootFolder, "external-volume/fixed-urls/FixedUrls.db");
const LIGHT_DB_URLS_PATH = path.join(apihubRootFolder, "/external-volume/lightDB/FixedUrls.db/database");

const migrateTableFromLokiToLightDB = async (lokiEnclaveFacadeInstance, tableName, lightDB) => {
    let records;
    try {
        records = await $$.promisify(lokiEnclaveFacadeInstance.getAllRecords)(undefined, tableName);
    } catch (e) {
        console.error("Failed to get records from table", tableName, e);
        throw e;
    }

    if (records && records.length > 0) {
        console.log(records.map(record => record.$loki));
    }

    for (let record of records) {
        try {
            delete record.meta;
            delete record.$loki;
            await $$.promisify(lightDB.insertRecord)($$.SYSTEM_IDENTIFIER, tableName, record.pk, record);
        } catch (e) {
            console.error("Failed to insert record", record, "in table", tableName, e);
            throw e;
        }
    }
}
const migrateAllTablesFromLokiToLightDB = async (lokiEnclaveFacadeInstance, lightDB) => {
    const tables = ["history", "tasks"];

    for (let table of tables) {
        try {
            await migrateTableFromLokiToLightDB(lokiEnclaveFacadeInstance, table, lightDB);
        } catch (e) {
            console.error("Failed to migrate table", table, e);
            throw e;
        }
    }
}
const migrateFSAdapterToLightDB = async (lightDB) => {
    const lokiEnclaveFacade = LokiEnclaveFacade.createLokiEnclaveFacadeInstance(FIXED_URLS_PATH, undefined, adapters.FS);
    await migrateAllTablesFromLokiToLightDB(lokiEnclaveFacade, lightDB);
}

const migrateStructuredFSAdapterToLightDB = async (lightDB) => {
    const lokiEnclaveFacade = LokiEnclaveFacade.createLokiEnclaveFacadeInstance(FIXED_URLS_PATH, undefined, adapters.STRUCTURED);
    await migrateAllTablesFromLokiToLightDB(lokiEnclaveFacade, lightDB);
}

const migrateFixedUrlToLightDB = async () => {
    try {
        fs.mkdirSync(path.dirname(LIGHT_DB_URLS_PATH), {recursive: true});
    } catch (e) {
        // if folder exists do nothing else throw error
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
    const lightDB = LokiEnclaveFacade.createLokiEnclaveFacadeInstance(LIGHT_DB_URLS_PATH, undefined, adapters.STRUCTURED);
    let stats

    try {
        stats = fs.statSync(FIXED_URLS_PATH);
    } catch (e) {
        console.log("Nothing to migrate");
        return;
    }

    if (stats.isDirectory()) {
        try {
            console.log("Trying to migrate FixedURL structured FS adapter");
            await migrateStructuredFSAdapterToLightDB(lightDB);
            fs.renameSync(FIXED_URLS_PATH, FIXED_URLS_PATH + ".migrated");
        } catch (e) {
            console.error("Failed to migrate FixedURL structured FS adapter", e);
        }

        return;
    }

    console.log("Trying to migrate fixedURL FS adapter")
    try {
        await migrateFSAdapterToLightDB(lightDB);
        fs.renameSync(FIXED_URLS_PATH, FIXED_URLS_PATH + ".migrated");
        console.log("FixedURL FS adapter migrated successfully");
    } catch (e) {
        console.error("Failed to migrate FS adapter", e);
    }
}

module.exports = migrateFixedUrlToLightDB;