const localRegistry = require("./src/presets/local-registry");

module.exports = {
  presets: [
    localRegistry({
      registryDir: "./registry-custom",
      packages: ["packages", "packages"],
    }),
  ],
};
