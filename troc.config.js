const localRegistry = require("./src/presets/local-registry");

// const path = require("path");

// console.log("@@", __dirname);

module.exports = {
  presets: [
    localRegistry({
      // registryDir: path.resolve(process.cwd(), "./registry-custom"),
      registryDir: "./registry-custom",
      // packages: ["./apps", "packages", "packages"],
    }),
  ],
};
