const fs = require("fs");
const path = require("path");
const Logger = require("./Logger");
const net = require("net");

const logger = new Logger("[TIR]");

const mkdirAsync = $$.promisify(fs.mkdir);
const writeFileAsync = $$.promisify(fs.writeFile);

function sleepAsync(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomPort() {
    const min = 9000;
    const max = 65535;
    return Math.floor(Math.random() * (max - min) + min);
}

async function getRandomAvailablePortAsync(maxTries = 10) {
    while (maxTries > 0) {
        let port = getRandomPort();
        logger.info(`Generated random port ${port}`);

        if (await isPortAvailableAsync(port)) {
            logger.info(`Port ${port} is available`);
            return port;
        }

        maxTries--;
    }

    throw new Error(`Could not find available port after ${maxTries} retries`);
}

function createKey(name) {
    let parsed = "" + name;
    parsed.replace(/^[A-Za-z0-9 ]+/g, " ");
    return parsed
        .split(" ")
        .map((word, idx) =>
            idx === 0 ? word.toLocaleLowerCase() : word.substr(0, 1).toLocaleUpperCase() + word.toLowerCase().substr(1)
        )
        .join("");
}

function createConstitutionFromSources(sources, options, callback) {
    const child_process = require("child_process");

    let pskBuildPath = path.resolve(path.join(__dirname, "../../psknode/bin/scripts/pskbuild.js"));
    if (typeof process.env.PSK_ROOT_INSTALATION_FOLDER !== "undefined") {
        pskBuildPath = path.resolve(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "psknode/bin/scripts/pskbuild.js"));
    }

    let internalOptions = {
        constitutionName: "domain",
        outputFolder: null,
        cleanupTmpDir: true,
    };

    if (typeof sources === "string") {
        sources = [sources];
    }

    if (typeof options === "function") {
        callback = options;
    } else if (typeof options === "string") {
        internalOptions.outputFolder = options;
    } else if (typeof options === "object") {
        Object.assign(internalOptions, options);
    }

    let sourcesNames = [];
    let sourcesPaths = [];

    if (sources && sources.length && sources.length > 0) {
        sourcesNames = sources.map((source) => path.basename(source));
        sourcesPaths = sources.map((source) => path.dirname(source));
    }

    sourcesNames = sourcesNames.join(",");
    sourcesPaths = sourcesPaths.join(",");

    const projectMap = {
        [internalOptions.constitutionName]: {deps: sourcesNames, autoLoad: true},
    };

    const dc = require("double-check");
    const removeDir = require("swarmutils").removeDir;

    dc.createTestFolder("PSK_DOMAIN-", (err, tmpFolder) => {
        if (err) {
            return callback(err);
        }

        const projectMapPath = path.join(tmpFolder, "projectMap.json");
        fs.writeFile(projectMapPath, JSON.stringify(projectMap), "utf8", (err) => {
            if (err) {
                return callback(err);
            }

            let outputFolder = null;

            if (internalOptions.outputFolder) {
                outputFolder = internalOptions.outputFolder;
            } else {
                internalOptions.cleanupTmpDir = false;
                outputFolder = tmpFolder;
            }

            child_process.exec(
                `node ${pskBuildPath} --projectMap=${projectMapPath} --source=${sourcesPaths} --output=${outputFolder} --input=${tmpFolder}`,
                (err) => {
                    if (err) {
                        return callback(err);
                    }

                    callback(undefined, path.join(outputFolder, `${internalOptions.constitutionName}.js`));

                    if (internalOptions.cleanupTmpDir) {
                        removeDir(tmpFolder, {recursive: true}, (err) => {
                            if (err) {
                                logger.warn(`Failed to delete temporary folder "${tmpFolder}"`);
                            }
                        });
                    }
                }
            );
        });
    });
}

function createConstitution(prefix, describer, options, constitutionSourcesFolder, callback) {
    constitutionSourcesFolder = constitutionSourcesFolder || [];

    if (typeof constitutionSourcesFolder === "string") {
        constitutionSourcesFolder = [constitutionSourcesFolder];
    }

    const contents = buildConstitutionFromDescription(describer, options);

    if (contents && contents !== "") {
        const tempConstitutionFolder = path.join(prefix, "tmpConstitution");
        const file = path.join(tempConstitutionFolder, "index.js");

        fs.mkdirSync(tempConstitutionFolder, {recursive: true});
        fs.writeFileSync(file, contents);
        constitutionSourcesFolder.push(tempConstitutionFolder);
    }

    logger.debug("Will construct constitution from", constitutionSourcesFolder);
    createConstitutionFromSources(constitutionSourcesFolder, prefix, callback);
}

function whenAllFinished(array, handler, callback) {
    let tasksLeft = array.length;

    if (tasksLeft === 0) {
        callback();
    }

    for (const task of array) {
        handler(task, (err) => {
            tasksLeft--;

            if (err) {
                tasksLeft = -1;
                return callback(err);
            }

            if (tasksLeft === 0) {
                callback(undefined);
            }
        });
    }
}

function buildConstitution(path, targetArchive, callback) {
    process.env.PSK_ROOT_INSTALATION_FOLDER = require("path").join(__dirname, "../../../");
    createConstitutionFromSources(path, (err, fileName) => {
        if (err) {
            return callback(err);
        }
        targetArchive.addFile(fileName, pskPath.join(openDSU.constants.CONSTITUTION_FOLDER, "domain.js"), callback);
    });
}

function storeFile(rootFolder, filename, content, callback) {
    if (typeof callback !== "function") {
        console.trace("storefile");
    }
    callback = $$.makeSaneCallback(callback);
    storeFileAsync(rootFolder, filename, content)
        .then((result) => callback(undefined, result))
        .catch((error) => callback(error));
}

async function storeFileAsync(rootFolder, filename, content) {
    logger.info(`Storing file '${filename}' at ${rootFolder}`, content);

    try {
        await mkdirAsync(rootFolder, {recursive: true});
    } catch (error) {
        logger.error(`Cannot create folder path ${rootFolder}`, error);
        throw error;
    }

    await writeFileAsync(path.join(rootFolder, filename), content);
}

function isPortAvailable(port, callback) {
    callback = $$.makeSaneCallback(callback);
    isPortAvailableAsync(port)
        .then((result) => callback(undefined, result))
        .catch((error) => callback(error));
}

async function isPortAvailableAsync(port) {
    logger.info(`TIR is checking if port ${port} is available. Please wait...`);

    return new Promise((resolve) => {
        const net = require('net');
        const client = net.createConnection({port}, () => {
            client.end();
            resolve(false)
        });
        client.on("error", (err) => {
            resolve(true);
        })
    });
}

module.exports = {
    sleepAsync,
    getRandomPort,
    createKey,
    createConstitutionFromSources,
    createConstitution,
    whenAllFinished,
    buildConstitution,
    storeFile,
    storeFileAsync,
    isPortAvailable,
    isPortAvailableAsync,
    getRandomAvailablePortAsync,
};
