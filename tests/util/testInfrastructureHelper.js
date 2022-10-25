/**
 * Test Infrastructure Helper
 */
require("../../build/output/apiHub.js");

const ApiHubTestNodeLauncher = require("./ApiHubTestNodeLauncher");

const TestInfrastructureHelper = function () {

    this.launchApiHubTestNode = function(maxTries, rootFolder, callback) {
        let config = {};
        if (!callback) {
            throw Error(`Invalid number of arguments`);
        }
        config = {maxTries, rootFolder};
        const apiHubTestNodeLauncher = new ApiHubTestNodeLauncher(config);
        apiHubTestNodeLauncher.launch((err, result) => {
            if (err) {
                return callback(err);
            }
            const {port, node} = result;
            callback(null, port);
        });
    }

    this.launchConfigurableApiHubTestNode = (config, callback) => {
        callback = $$.makeSaneCallback(callback);
        this.launchConfigurableApiHubTestNodeAsync(config)
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchConfigurableApiHubTestNodeAsync = async (config) => {
        if (config && typeof config !== "object") {
            throw new Error("Invalid config specified");
        }
        config = config || {};

        const apiHubTestNodeLauncher = new ApiHubTestNodeLauncher(config);
        const {node, ...rest} = await apiHubTestNodeLauncher.launchAsync();
        return rest;
    };

    this.getRandomAvailablePortAsync = require("./tir-utils").getRandomAvailablePortAsync;

    this.launchApiHubTestNodeWithContract = (contractBuildFilePath, domain, config, callback) => {
        if (typeof config === "function") {
            callback = config;
            config = null;
        }
        if (typeof domain === "function") {
            callback = domain;
            config = null;
            domain = null;
        }
        if (typeof contractBuildFilePath === "function") {
            callback = contractBuildFilePath;
            config = null;
            domain = null;
            contractBuildFilePath = null;
        }
        callback = $$.makeSaneCallback(callback);
        this.launchApiHubTestNodeWithContractAsync(domain, config, callback)
            .then((result) => callback(undefined, result))
            .catch((error) => callback(error));
    };

    this.launchApiHubTestNodeWithContractAsync = async (contractBuildFilePath, domain, config) => {
        if (!contractBuildFilePath || typeof contractBuildFilePath !== "string") {
            throw new Error("Missing or invalid contractBuildFilePath");
        }
        if (typeof domain === "object") {
            config = domain;
            domain = null;
        }
        if (!config) {
            config = {};
        }
        if (!domain && !config.domains) {
            domain = "contract";
            config = {...config, domains: [domain]};
        }

        config = {...config, contractBuildFilePath};
        const apiHubTestNodeLauncher = new ApiHubTestNodeLauncher(config);
        const {node, ...rest} = await apiHubTestNodeLauncher.launchAsync();

        // return the updated domainConfig for further usage inside integration tests
        const domainConfig =
            config.domains && config.domains[0] && typeof config.domains[0] === "object" ? config.domains[0].config : {};
        domainConfig.contracts = domainConfig.contracts || {};
        domainConfig.contracts.constitution = rest.contractConstitution;

        const result = {
            ...rest,
            // domainConfig for contract domain
            domainConfig,
        };

        return result;
    };
};

module.exports = new TestInfrastructureHelper();
