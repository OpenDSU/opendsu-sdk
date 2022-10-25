const fs = require("fs");
const path = require("path");
const Logger = require("./Logger");
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
    whenAllFinished,
    storeFile,
    storeFileAsync,
    isPortAvailable,
    isPortAvailableAsync,
    getRandomAvailablePortAsync,
};
