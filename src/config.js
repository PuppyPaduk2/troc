const { cosmiconfigSync } = require("cosmiconfig");
const { parse: parsePath } = require("path");

const localRegistry = require("./presets/local-registry");

const configExplorer = cosmiconfigSync("troc");
const resultSearch = configExplorer.search();

const fileConfig = resultSearch ? resultSearch.filepath : null;
const rawConfig = resultSearch ? resultSearch.config : {};

const config = {
  presets: rawConfig.presets || [localRegistry()],
};

const presets = config.presets.map((attachPreset) => {
  return attachPreset({
    dir: fileConfig ? parsePath(fileConfig).dir : null,
  });
});

const runPresets = async (...args) => {
  const results = [];

  for (let index = 0; index < presets.length; index += 1) {
    const preset = presets[index];
    const result = await preset.apply(null, args);

    results.push(result);
  }

  return results;
};

module.exports = { config, runPresets };
