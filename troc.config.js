const { resolve: resolvePath } = require("path");
const localRegistry = require("./src/presets/local-registry");

const registryDirPath = resolvePath(process.cwd(), "./registry-custom");

module.exports = {
  presets: [localRegistry({ registryDirPath })],
};
