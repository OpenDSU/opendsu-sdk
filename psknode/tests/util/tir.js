/**
 * Test Infrastructure Runner
 *
 */
const path = require("path");
process.env.PSK_ROOT_INSTALATION_FOLDER = path.join(__dirname, "../../../");

require(path.resolve(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "psknode/bundles/pskWebServer.js")));

const os = require("os");
const fs = require("fs");
const pskPath = require("swarmutils").path;
const removeDirSync = require("swarmutils").removeDirSync;

const {createKey, buildConstitution, getRandomAvailablePortAsync} = require("./tir-utils");
const ApiHubTestNodeLauncher = require("./ApiHubTestNodeLauncher");

const Tir = function () {
    const domainConfigs = {};
    const rootFolder = fs.mkdtempSync(path.join(os.tmpdir(), "psk_"));

    let testerNode = null;
    let virtualMQNode = null;

    /**
     * Adds a domain to the configuration, in a fluent way.
     * Does not launch anything, just stores the configuration.
     *
     * @param {string} domainName The name of the domain
     * @param {array} agents The agents to be inserted
     * @param {string} constitutionSourceFolder
     * @param bundlesSourceFolder
     * @returns SwarmDescriber
     */
    this.addDomain = function (domainName, agents, constitutionSourceFolder, bundlesSourceFolder) {
        let workspace = path.join(rootFolder, "nodes", createKey(domainName));
        domainConfigs[domainName] = {
            name: domainName,
            agents,
            /*constitution: {},*/
            constitutionSourceFolder,
            bundlesSourceFolder: bundlesSourceFolder || path.resolve(path.join(__dirname, "../../bundles")),
            workspace: workspace,
            blockchain: path.join(workspace, "conf"),
        };
    };

    function launchApiHubTestNode(maxTries, rootFolder, callback) {
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
            virtualMQNode = node;
            callback(null, port);
        });
    }

    this.launchVirtualMQNode = launchApiHubTestNode;
    this.launchApiHubTestNode = launchApiHubTestNode;

    this.getDomainConfig = (domainName) => {
        return domainConfigs[domainName];
    };

    /**
     * Tears down all the nodes
     *
     * @param exitStatus The exit status, to exit the process.
     */
    this.tearDown = (exitStatus) => {
        console.info("[TIR] Tearing down...");
        if (testerNode) {
            console.info("[TIR] Killing node", testerNode.pid);
            try {
                process.kill(testerNode.pid);
            } catch (e) {
                console.info("[TIR] Node already killed", testerNode.pid);
            }
            testerNode = null;
        }

        if (virtualMQNode) {
            console.log("[TIR] Killing VirtualMQ node", virtualMQNode.pid);
            try {
                process.kill(virtualMQNode.pid);
            } catch (e) {
                console.info("[TIR] VirtualMQ node already killed", virtualMQNode.pid);
            }
        }

        setTimeout(() => {
            try {
                console.info("[TIR] Removing temporary folder", rootFolder);
                removeDirSync(rootFolder, {recursive: true});
                console.info("[TIR] Temporary folder removed", rootFolder);
            } catch (e) {
                //just avoid to display error on console
            }

            /*if (exitStatus !== undefined) {
                process.exit(exitStatus);
            }*/
        }, 100);
    };

    this.restart = (callback) => {
        if (virtualMQNode) {
            console.log("[TIR] Killing VirtualMQ node", virtualMQNode.pid);
            try {
                process.kill(virtualMQNode.pid);
            } catch (e) {
                console.info("[TIR] VirtualMQ node already killed", virtualMQNode.pid);
            }
        }
        launchApiHubTestNode(100, rootFolder, callback);
    }

    this.buildConstitution = buildConstitution;

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
        virtualMQNode = node;
        return rest;
    };

    this.getRandomAvailablePortAsync = getRandomAvailablePortAsync;

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
        virtualMQNode = node;

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

module.exports = new Tir();
