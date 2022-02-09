const { cosmiconfigSync } = require("cosmiconfig");
const { resolve: resolvePath } = require("path");

const name = "troc";
const configExplorer = cosmiconfigSync(name);
const searching = configExplorer.search();
const config = {
  port: 5000,
  registryDir: "./registry",
  infoFile: "info.json",
  proxies: [{ name: "*", host: "https://registry.npmjs.org" }],
  ...(searching ? searching.config : null),
};

const registryDirPath = resolvePath(process.cwd(), config.registryDir);

module.exports = { config, registryDirPath };
