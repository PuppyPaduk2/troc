const { resolve: resolvePath } = require("path");
const ora = require("ora");

const handleNpmRequest = require("./npm");
const handleApiRequest = require("./api");
const handleInstallRequest = require("./install");
const handlePublishRequest = require("./publish");
const searchPackages = require("./search-packages");
const publishPackage = require("./publish-package");

function createPreset(options = {}) {
  const fullOptions = buildOptions(options);
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
    handlePostRequest: handlePostRequest.bind(null, fullOptions),
    handleErrorRequest: handleError.bind(null, fullOptions),

    // For publish command
    searchPackages: searchPackages.bind(null, fullOptions),
    publishPackage: publishPackage.bind(null, fullOptions),
    publishedPackages: () => null,
  };

  return async function preset(key, ...args) {
    const handler = handlers[key];

    if (handler) {
      return await handler.apply(null, args);
    }

    return null;
  };
}

function buildOptions(options = {}) {
  const port = options.port || 5000;
  const baseDir = options.baseDir || process.cwd();
  const registryDir = options.registryDir || resolvePath(baseDir, "./registry");
  const infoFile = "info.json";
  const proxies = options.proxies || [
    { name: "*", host: "https://registry.npmjs.org" },
  ];
  const packages = options.packages || ["."];
  const preId = options.preId || "local";
  const spinner = ora();

  return Object.freeze({
    port,
    baseDir,
    registryDir,
    infoFile,
    proxies,
    packages,
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

async function handlePostRequest({ spinner }, req) {
  const referer = req.headers["referer"] || "";

  if (req.url === "/-/npm/v1/security/audits/quick") {
    spinner.succeed(referer);
  } else if (referer === "publish") {
    spinner.succeed(`Publish ${decodeURIComponent(req.url || "")}`);
  }
}

async function handleError({ spinner }, error, { res }) {
  spinner.fail();
  console.log(error);
  res.statusCode = 400;
  res.end();
}

module.exports = createPreset;
