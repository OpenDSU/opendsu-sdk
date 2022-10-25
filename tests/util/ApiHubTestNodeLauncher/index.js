const { sleepAsync, getRandomPort, getRandomAvailablePortAsync, isPortAvailableAsync } = require("../tir-utils");

const {
    getCompleteOptions,
    storeRequiredEnvironmentVariables,
    loadValidatorDIDInstanceAsync,
    getValidatorDIDAsync,
    getValidators,
    getBDNSEntries,
    createApiHubInstanceAsync,
    createApiHubInstanceWorkerAsync,
    updateDomainConfigsWithContractConstitutionAsync,
    storeServerConfigAsync,
    storeServerDomainConfigsAsync,
    storeDBNSAsync,
} = require("./launcher-utils");
const Logger = require("../Logger");
const clone = (data)=>{return JSON.parse(JSON.stringify(data));}

const logger = new Logger("[TIR]");

const defaultOptions = {
    maxTries: 100,
    rootFolder: null,
    serverConfig: {},
    domains: null,
    bdns: null,
    validatorDID: null,
    validators: null,
    useWorker: false,
    bricksLedgerConfig: null,
    includeDefaultDomains: true,
    contractBuildFilePath: null,
    generateValidatorDID: false,
    onPortAquired: null,
    onBeforeServerStart: null,
};

function ApiHubTestNodeLauncher(options) {
    if (!options) {
        options = clone(defaultOptions);
    }

    options = getCompleteOptions(options, clone(defaultOptions));
    logger.info("Using the following options for launcher", options);

    let { maxTries, rootFolder, storageFolder, port, serverConfig, domains } = options;

    this.launch = (callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchAsync()
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchAsync = async () => {
        let apiHubPort = port;
        if (!apiHubPort) {
            apiHubPort = await getRandomAvailablePortAsync(maxTries);
        }

        if (typeof options.onPortAquired === "function") {
            // allow for config to be changed when port is known
            options.onPortAquired(apiHubPort, options);
        }

        const nodeUrl = `http://localhost:${apiHubPort}`;

        storeRequiredEnvironmentVariables(rootFolder, nodeUrl);

        let validatorDID;
        let validators = [];

        serverConfig.host = "localhost";
        serverConfig.port = apiHubPort;

        await storeServerConfigAsync(rootFolder, serverConfig);
        await storeServerDomainConfigsAsync(rootFolder, domains);

        const isBricksLedgerRequired = !!options.contractBuildFilePath;
        if (isBricksLedgerRequired || options.generateValidatorDID) {
            validatorDID = await getValidatorDIDAsync(options);
            validators = getValidators(options, validatorDID, nodeUrl);

            serverConfig.validatorDID = validatorDID;
            await storeServerConfigAsync(rootFolder, serverConfig);
        }

        const bdns = getBDNSEntries(options, nodeUrl, validators);
        logger.info(`Using the following BDNS content for ${nodeUrl}:`, bdns);
        await storeDBNSAsync(rootFolder, bdns);

        if (isBricksLedgerRequired || options.generateValidatorDID) {
            // update BDNS inside opendsu since it's cached at startup and the validatorDID construction triggers the opendsu load
            const bdnsApi = require("opendsu").loadApi("bdns");
            bdnsApi.setBDNSHosts(bdns);
        }

        try {
            let contractConstitution;
            const { contractBuildFilePath, useWorker } = options;
            if (isBricksLedgerRequired) {
                const workerApiHubOptions = {
                    port: apiHubPort,
                    rootFolder,
                    contractBuildFilePath,
                    disableLogging: true,
                };

                const workerResult = await createApiHubInstanceWorkerAsync(workerApiHubOptions);
                contractConstitution = workerResult.domainSeed;

                await updateDomainConfigsWithContractConstitutionAsync(rootFolder, domains, contractConstitution);

                // wait until the port is cleared by the worker
                let portUsageCheckRetries = 10;
                while (portUsageCheckRetries > 0) {
                    if (await isPortAvailableAsync(apiHubPort)) {
                        logger.info(`Port ${apiHubPort} is available again`);
                        break;
                    }

                    logger.info(
                        `Waiting until port ${apiHubPort} is cleared by the worker (${portUsageCheckRetries} retries left)...`
                    );
                    await sleepAsync(500);

                    portUsageCheckRetries--;
                }
            }

            let validatorDIDInstance;
            if (validatorDID) {
                validatorDIDInstance = await loadValidatorDIDInstanceAsync(validatorDID);
            }

            const result = {
                port: apiHubPort,
                rootFolder,
                storageFolder,
                contractConstitution,
                validatorDID,
                validatorURL: nodeUrl,
                url: nodeUrl,
                validatorDIDInstance,
            };

            if (typeof options.onBeforeServerStart === "function") {
                const onBeforeResult = options.onBeforeServerStart(result);
                if (onBeforeResult instanceof Promise) {
                    // await for promise execution
                    await onBeforeResult;
                }
            }

            const apiHubNode = useWorker
                ? await createApiHubInstanceWorkerAsync({ port: apiHubPort, rootFolder })
                : await createApiHubInstanceAsync(apiHubPort, rootFolder);

            result.node = apiHubNode;

            return result;
        } catch (error) {
            logger.error(`Failed to start ApiHub on port ${apiHubPort}`, error);
            maxTries--;
            if (maxTries <= 0) {
                logger.error("Max ApiHub launch retries reached. Aborting launch...");
                throw error;
            }

            return this.launchAsync();
        }
    };
}

module.exports = ApiHubTestNodeLauncher;
