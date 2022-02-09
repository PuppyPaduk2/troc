const { cosmiconfigSync } = require("cosmiconfig");
const { resolve: resolvePath } = require("path");

const localRegistry = require("./presets/local-registry");

const name = "troc";
const configExplorer = cosmiconfigSync(name);
const searching = configExplorer.search();
const config = {
  port: 5000,
  registryDir: "./registry",
  infoFile: "info.json",
  proxies: [{ name: "*", host: "https://registry.npmjs.org" }],
  presets: [localRegistry()],
  ...(searching ? searching.config : null),
};

const registryDirPath = resolvePath(process.cwd(), config.registryDir);

const runPresets = async (...args) => {
  const results = [];

  for (let index = 0; index < config.presets.length; index += 1) {
    const preset = config.presets[index];
    const result = await preset.apply(null, args);

    results.push(result);
  }

  return results;
};

module.exports = { config, registryDirPath, runPresets };
