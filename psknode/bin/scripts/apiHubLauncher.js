let path = require("path");
const process = require("process");
let dirname = __dirname;
process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve(path.join(__dirname, "../../../"));
require(path.join(__dirname, '../../bundles/pskWebServer.js'));

const logger = $$.getLogger("Launcher", "logger");

const fs = require('fs');
path = require("swarmutils").path;
const API_HUB = require('apihub');

if (!process.env.PSK_ROOT_INSTALATION_FOLDER) {
    process.env.PSK_ROOT_INSTALATION_FOLDER = path.resolve("." + __dirname + "/../..");
}

if (!process.env.PSK_CONFIG_LOCATION) {
    process.env.PSK_CONFIG_LOCATION = "./conf";
}

let config = API_HUB.getServerConfig();

async function testAndExecuteMigrations(){
    try{
        let migrationsFolder = path.join(dirname,"migrations");
        logger.info(`Preparing to test if there are any migrations scripts to be executed before starting.`);
        let migrationsFolderContent = fs.readdirSync(migrationsFolder, {withFileTypes: true});
        if(!migrationsFolderContent.length){
            logger.info(`No migrations scripts found.`);
        }
        migrationsFolderContent = migrationsFolderContent.sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
        for(let entry of migrationsFolderContent){
            let name = entry.name;
            if(entry.isDirectory()){
                logger.info(`Skipping dir <${name}>`);
            }else{
                logger.info(`Preparing to execute the migration script <${name}>`);
                try{
                    let migration = path.join(migrationsFolder,name);
                    migration = require(migration);
                    await migration();
                    logger.info(`Migration <${name}> executed`);
                }catch(err){
                    logger.error(`Caught and error during the execution of <${name}> migration`, err);
                }
            }
        }
    }catch(err){
        logger.error(`Caught an error during migration script execution.`, err);
    }
}

function launch(){
    const listeningPort = Number.parseInt(config.port);
    const rootFolder = path.resolve(config.storage);

    function startLightDBInstance(callback){
        if(!process.env.LIGHT_DB_SERVER_ADDRESS){
            const ligthDBPort = process.env.LIGHT_DB_PORT || 8081;
            const {createLightDBServerInstance} = require("loki-enclave-facade");
            const storage = process.env.LIGHT_DB_STORAGE || config.lightDBStorage || path.join(rootFolder, "external-volume/lightDB");
            config.lightDBStorage = storage;
            config.lightDBPort = ligthDBPort;
            createLightDBServerInstance(config, (err) => {
                if (err) {
                    logger.error(`Failed to start LightDB instance`);
                    return logger.error(err);
                }
                if(callback){
                    callback();
                }
            });
        }
    }

    if(process.argv.indexOf("--ligthDBOnly")!==-1){
        logger.info("Starting LightDB only due to --lightDBOnly flag");
        return startLightDBInstance();
    }

    const cluster  = require("cluster");
    const { cpus } = require("os");
    const LokiEnclaveFacade = require("../../../modules/loki-enclave-facade/LokiEnclaveFacade");
    const numCPUs = 1 || cpus().length;

    if (cluster.isPrimary) {
        logger.log(`Primary process with PID ${process.pid} is running`);

        startLightDBInstance(function(){
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
    }else{
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

testAndExecuteMigrations().then(()=>{
    setTimeout(launch, 0);
}).catch(err=>{
    if(err){
        logger.error(err);
    }
});