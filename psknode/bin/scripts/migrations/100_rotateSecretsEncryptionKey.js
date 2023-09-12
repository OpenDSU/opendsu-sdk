const apihubModule = require("apihub");
const rotateKeyAsync = async () => {
    const path = require("path");
    console.log("Attempting to rotate secrets encryption key...");
    const apihubRootFolder = apihubModule.getServerConfig().storage;
    const secretsService = await apihubModule.getSecretsServiceInstanceAsync(apihubRootFolder);
    await secretsService.rotateKeyAsync();
}

module.exports = rotateKeyAsync;