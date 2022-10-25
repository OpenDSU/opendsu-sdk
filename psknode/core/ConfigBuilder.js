const fs = require('fs');
const path = require('path');

let confFolder = process.env.PSK_CONFIG_LOCATION;
const seedFileName = 'confSeed';
const vmqPort = process.env.vmq_port || 8080;
const vmqAddress = `http://127.0.0.1:${vmqPort}`;
const identity = "launcherIdentity";
const defaultDomainName = "demo";

if (!confFolder.endsWith('/')) {
    confFolder += '/';
}

const constitutionFolder = path.resolve(path.join(__dirname, '../bundles/'));
const seedFileLocation = `${confFolder}${seedFileName}`;

if (typeof process.env.vmq_zeromq_forward_address === "undefined") {
    process.env.vmq_zeromq_forward_address = "tcp://127.0.0.1:5001";
}
if (typeof process.env.vmq_zeromq_sub_address === "undefined") {
    process.env.vmq_zeromq_sub_address = "tcp://127.0.0.1:5000";
}
if (typeof process.env.vmq_zeromq_pub_address === "undefined") {
    process.env.vmq_zeromq_pub_address = "tcp://127.0.0.1:5001";
}

const communicationInterfaces = {
    system: {
        virtualMQ: vmqAddress,
        zeroMQ: process.env.vmq_zeromq_sub_address
    }
};

const dossier = require('dossier');
const pskPath = require("swarmutils").path;
const openDSU = require('opendsu');
const resolver = openDSU.loadApi('resolver');
const keyssi = openDSU.loadApi('keyssi');
const DEFAULT_DOMAIN = 'default';
function ensureEnvironmentIsReady(vmqAddress, callback) {

    if (!$$.securityContext) {
        $$.securityContext = require("psk-security-context").createSecurityContext();
    }
    waitForServer(vmqAddress, callback);
}

function createOrUpdateConfiguration(fileConfiguration, callback) {
    ensureEnvironmentIsReady(vmqAddress, (err) => {
        $$.securityContext.generateIdentity((err) => {
            if (err) throw err;
            if (fileConfiguration) {
                resolver.loadDSU(fileConfiguration.constitutionSeed, (err, constitutionBar) => {
                    if (err) {
                        throw err;
                    }

                    constitutionBar.delete("/", (err) => {
                        if (err) {
                            throw err;
                        }
                        constitutionBar.addFolder(constitutionFolder, "/", { encrypt: true }, (err) => {
                            callback(err, fileConfiguration.launcherSeed);
                        });
                    });
                });
            } else {
                let fileConfiguration = {};
                resolver.createDSU(keyssi.buildTemplateSeedSSI(DEFAULT_DOMAIN), (err, constitutionBar) => {
                    if (err) {
                        throw err;
                    }

                    constitutionBar.load((err) => {
                        if (err) {
                            throw err;
                        }

                        constitutionBar.addFolder(constitutionFolder, "/", { encrypt: true }, (err) => {
                            if (err) {
                                throw err;
                            }

                            constitutionBar.getKeySSIAsString((err, keySSI) => {
                                if (err) {
                                    throw err;
                                }
                                fileConfiguration.constitutionSeed = keySSI;
                                buildDossierInfrastructure(fileConfiguration);
                            });
                        });
                    })
                });
            }

            function buildDossierInfrastructure(fileConfiguration) {
                resolver.createDSU(keyssi.buildTemplateSeedSSI(DEFAULT_DOMAIN), (err, launcherConfigDossier) => {
                    if (err) {
                        throw err;
                    }

                    launcherConfigDossier.writeFile(openDSU.constants.DOMAIN_IDENTITY_FILE, " ", (err) => {
                        if (err) {
                            throw err;
                        }

                        launcherConfigDossier.getKeySSIAsString((err, keySSI) => {
                            if (err) {
                                throw err;
                            }

                            fileConfiguration.launcherSeed = keySSI;
                            if (err) {
                                throw err;
                            }

                            resolver.createDSU(keyssi.buildTemplateSeedSSI(DEFAULT_DOMAIN), (err, domainConfigDossier) => {
                                if (err) {
                                    throw err;
                                }

                                domainConfigDossier.writeFile(openDSU.constants.DOMAIN_IDENTITY_FILE, defaultDomainName, (err) => {
                                    if (err) {
                                        throw err;
                                    }

                                    domainConfigDossier.getKeySSIAsString((err, domainKeySSI) => {
                                        if (err) {
                                            throw err;
                                        }

                                        fileConfiguration.domainSeed = domainKeySSI;
                                        launcherConfigDossier.mount(openDSU.constants.CONSTITUTION_FOLDER, fileConfiguration.constitutionSeed, function (err) {
                                            if (err) {
                                                throw err;
                                            }

                                            domainConfigDossier.mount(openDSU.constants.CONSTITUTION_FOLDER, fileConfiguration.constitutionSeed, function (err) {
                                                if (err) {
                                                    throw err;
                                                }

                                                domainConfigDossier.readFile(openDSU.constants.MANIFEST_FILE, function (err, content) {
                                                    if (err) {
                                                        throw err;
                                                    }


                                                });

                                                dossier.load(fileConfiguration.launcherSeed, identity, (err, launcherCSB) => {
                                                    if (err) {
                                                        throw err;
                                                    }

                                                    launcherCSB.startTransaction("Domain", "getDomainDetails", defaultDomainName)
                                                        .onReturn((err, domainDetails) => {
                                                            if (err) {
                                                                //means no demo domain found... let's build it
                                                                dossier.load(fileConfiguration.domainSeed, identity, (err, domainCSB) => {
                                                                    if (err) {
                                                                        throw err;
                                                                    }

                                                                    launcherCSB.startTransaction("Domain", "add", defaultDomainName, "system", '../../', fileConfiguration.domainSeed)
                                                                        .onReturn((err) => {
                                                                            if (err) {
                                                                                throw err;
                                                                            }

                                                                            domainCSB.startTransaction('DomainConfigTransaction', 'add', defaultDomainName, communicationInterfaces)
                                                                                .onReturn((err) => {
                                                                                    if (err) {
                                                                                        throw err;
                                                                                    }

                                                                                    fs.writeFileSync(seedFileLocation, JSON.stringify(fileConfiguration), 'utf8');
                                                                                    callback(undefined, fileConfiguration.launcherSeed);
                                                                                });
                                                                        });
                                                                });
                                                            }
                                                        });
                                                });
                                            });
                                        });
                                    });
                                });
                            })
                        });
                    });
                })
            }
        });
    });
}

function getKeySSI(callback) {
    let fileConfiguration;
    /*try {
        fileConfiguration = fs.readFileSync(seedFileLocation, 'utf8');
        fileConfiguration = JSON.parse(fileConfiguration);
    } catch (err) {
        // no need to treat here errors ... i think...
    } finally {*/
    createOrUpdateConfiguration(fileConfiguration, callback);
    /*}*/
}

try {
    require("psk-http-client");
} catch (e){
    throw e;
}

function waitForServer(url, callback) {
    $$.remote.doHttpGet(url, (err) => {
        if (err && err.statusCode !== 403) {
            console.log(`The request to ${url} failed. Status code ${err.statusCode}. Waiting for server to start...`);
            setTimeout(() => {
                waitForServer(url, callback);
            }, 100);
        } else {
            callback(undefined);
        }
    });
}

module.exports = {
    getKeySSI
};

