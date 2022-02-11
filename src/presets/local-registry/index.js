const { resolve: resolvePath } = require("path");
const ora = require("ora");

const handleNpmRequest = require("./npm");
const handleApiRequest = require("./api");
const handleInstallRequest = require("./install");
const handlePublishRequest = require("./publish");
const searchPackages = require("./search-packages");
const publishPackage = require("./publish-package");
const takeRegistryPackages = require("./take-registry-packages");
const installPackage = require("./install-package");

function createPreset(options = {}) {
  return function attachPreset(config = {}) {
    const fullOptions = buildOptions(options, config);
    const handlers = {
      // For start command
      initialStart: initialStart.bind(null, fullOptions),
      listenServer: listenServer.bind(null, fullOptions),
      handlePreRequest: handlePreRequest.bind(null, fullOptions),
      handleNpmRequest: handleNpmRequest.bind(null, fullOptions),
      handleApiRequest: handleApiRequest.bind(null, fullOptions),
      handleInstallRequest: handleInstallRequest.bind(null, fullOptions),
      handlePublishRequest: handlePublishRequest.bind(null, fullOptions),
      handleBadRequest: handleBadRequest.bind(null, fullOptions),
      handlePostRequest: () => null,
      handleErrorRequest: handleError.bind(null, fullOptions),
      handleCommandEnd: handleCommandEnd.bind(null, fullOptions),

      // For publish command
      searchPackages: searchPackages.bind(null, fullOptions),
      publishPackage: publishPackage.bind(null, fullOptions),
      publishedPackages: () => null,

      // For install command
      takeRegistryPackages: takeRegistryPackages.bind(null, fullOptions),
      installPackage: installPackage.bind(null, fullOptions),
      installedPackages: () => null,
    };
    return async function preset(key, ...args) {
      const handler = handlers[key];

      if (handler) {
        return await handler.apply(null, args);
      }

      return null;
    };
  };
}

function buildOptions(options = {}, config = {}) {
  const port = options.port || 5000;
  const baseDir = options.baseDir || config.dir || process.cwd();
  const registryDir = resolvePath(baseDir, options.registryDir || "./registry");
  const infoFile = "info.json";
  const installProxies = options.proxies || [
    { name: "*", host: "https://registry.npmjs.org" },
  ];
  const packages = options.packages || ["."];
  const ignore = options.ignore || ["package.json"];
  const preId = options.preId || "local";
  const spinner = ora();

  return Object.freeze({
    port,
    baseDir,
    registryDir,
    infoFile,
    installProxies,
    packages,
    ignore,
    preId,
    spinner,
  });
}

async function initialStart({ port }) {
  return { port };
}

async function listenServer({ port }) {
  console.log(`Server started on http://localhost:${port}`);
}

async function handlePreRequest({ spinner }, req) {
  spinner.start(`${req.method} ${req.url}`);
}

async function handleBadRequest({ spinner }, _, res) {
  spinner.fail();
  res.statusCode = 400;
  res.end();
}

async function handleCommandEnd({ spinner }, { req, commandType }) {
  if (commandType) {
    const referer = req.headers["referer"] || "";

    spinner.succeed(referer);
  }
}

async function handleError({ spinner }, error, { res }) {
  spinner.fail();
  console.log(error);
  res.statusCode = 400;
  res.end();
}

module.exports = createPreset;
