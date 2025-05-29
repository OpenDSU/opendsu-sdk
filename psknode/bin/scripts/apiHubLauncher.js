let path = require("path");
const process = require("process");
let dirname = __dirname;
process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../"));
require(path.join(__dirname, '../../../builds/output/pskWebServer.js'));

const logger = $$.getLogger("Launcher", "logger");

const fs = require('fs');
const crypto = require("crypto");
if (!process.env.SSO_SECRETS_ENCRYPTION_KEY || process.env.SSO_SECRETS_ENCRYPTION_KEY === "") {
    console.warn("SSO_SECRETS_ENCRYPTION_KEY is not set, generating a random one");
    process.env.SSO_SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
}
const cluster = require("cluster");

if (cluster.isPrimary) {
    function logMemoryUsage() {
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const formattedMemoryUsage = {
                timestamp: new Date().toISOString(),
                rss: (memoryUsage.rss / (1024 * 1024)).toFixed(2) + ' MB',
                heapTotal: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2) + ' MB',
                heapUsed: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2) + ' MB',
                external: (memoryUsage.external / (1024 * 1024)).toFixed(2) + ' MB',
                arrayBuffers: (memoryUsage.arrayBuffers / (1024 * 1024)).toFixed(2) + ' MB'
            };

            console.info(0x666, formattedMemoryUsage);
        }, 60000);
    }

    logMemoryUsage();
}

path = require("swarmutils").path;
const API_HUB = require('apihub');

if (!process.env.PSK_ROOT_INSTALATION_FOLDER) {
    process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve("." + __dirname + "/../..");
}

if (!process.env.PSK_CONFIG_LOCATION) {
    process.env.PSK_CONFIG_LOCATION = "./conf";
}

let config = API_HUB.getServerConfig();

const { cpus } = require("os");
const numCPUs = config.workers || cpus().length;
logger.info("Starting in cluster mode with", numCPUs, "workers");
async function testAndExecuteMigrations() {
    if (!cluster.isPrimary) {
        return;
    }

    try {
        let migrationsFolder = path.join(dirname, process.env.MIGRATION_FOLDER_PATH || "migrations");
        logger.info(`Preparing to test if there are any migrations scripts to be executed before starting.`);
        logger.debug(`Reading the ${migrationsFolder} for any migrations that may be needed`);
        let migrationsFolderContent;
        try {
            migrationsFolderContent = fs.readdirSync(migrationsFolder, { withFileTypes: true });
        } catch (e) {
            if (e.code === 'ENOENT') {
                logger.info(`No migrations scripts found.`);
                return;
            }
            throw e;
        }
        if (!migrationsFolderContent.length) {
            logger.info(`No migrations scripts found.`);
        }
        migrationsFolderContent = migrationsFolderContent.sort((a, b) => {
            return a.name.localeCompare(b.name, 'en', { numeric: true });
        });
        for (let entry of migrationsFolderContent) {
            let name = entry.name;
            if (entry.isDirectory()) {
                logger.info(`Skipping dir <${name}>`);
            } else {
                if (name.indexOf('.js') === -1) {
                    logger.info(`Skipping file <${name}> because is not *.js`);
                    continue;
                }
                logger.info(`Preparing to execute the migration script <${name}>`);
                try {
                    let migration = path.join(migrationsFolder, name);
                    migration = require(migration);
                    await migration();
                    logger.info(`Migration <${name}> executed`);
                } catch (err) {
                    logger.error(`Caught and error during the execution of <${name}> migration`, err);
                }
            }
        }
    } catch (err) {
        logger.error(`Caught an error during migration script execution.`, err);
    }
}

function launch() {
    const listeningPort = Number.parseInt(config.port);
    const rootFolder = path.resolve(config.storage);

    function startLightDBInstance(callback) {
        if (!process.env.LIGHT_DB_SERVER_ADDRESS) {
            const ligthDBPort = process.env.LIGHT_DB_PORT || 8081;
            const { createLightDBServerInstance } = require("loki-enclave-facade");
            const storage = process.env.LIGHT_DB_STORAGE || config.lightDBStorage || path.join(rootFolder, "external-volume/lightDB");
            config.lightDBStorage = storage;
            config.lightDBPort = ligthDBPort;
            config.sqlConfig = process.env.SQL_CONFIG;
            createLightDBServerInstance(config, (err) => {
                if (err) {
                    logger.error(`Failed to start LightDB instance`);
                    return logger.error(err);
                }
                if (callback) {
                    callback();
                }
            });
        } else {
            if (callback) {
                callback();
            }
        }
    }

    if (process.argv.indexOf("--ligthDBOnly") !== -1) {
        logger.info("Starting LightDB only due to --lightDBOnly flag");
        return startLightDBInstance();
    }


    if (cluster.isPrimary) {
        logger.log(`Primary process with PID ${process.pid} is running`);

        startLightDBInstance(function () {
            logger.info(`A number of ${numCPUs} workers will be forked in the following moments`);
            // Fork workers.
            for (let i = 0; i < numCPUs; i++) {
                logger.log(`Worker #${i} is preparing to start`);
                cluster.fork();
            }

            cluster.on('exit', (worker, code, signal) => {
                logger.log(`Worker ${worker.process.pid} died (code=${code}, signal=${signal})`);
            });
        });
    } else {
        logger.info(`Worker with PID ${process.pid} is preparing to run.`)
        let sslConfig = undefined;
        try {
            logger.log(`Looking to see if server.cert and server.key files available in folder:`, path.resolve(config.sslFolder));
            sslConfig = {
                cert: fs.readFileSync(path.join(config.sslFolder, 'server.cert')),
                key: fs.readFileSync(path.join(config.sslFolder, 'server.key'))
            };
            logger.log(`HTTPS necessary files found, ApiHub will try to start in HTTPS mode.`);
        } catch (e) {
            logger.log(`No certificates found, ApiHub will be HTTP only.`);
        }

        API_HUB.createInstance(listeningPort, rootFolder, sslConfig, (err) => {
            if (err) {
                logger.error(err);
                process.exit(err.errno || 1);
            }
            logger.log(`\nlistening on port :${listeningPort} and ready to receive requests.\n`);
        });
    }
}

testAndExecuteMigrations().then(() => {
    setTimeout(launch, 0);
}).catch(err => {
    if (err) {
        logger.error(err);
    }
});