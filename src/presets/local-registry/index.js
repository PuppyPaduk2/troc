const { resolve: resolvePath } = require("path");
const ora = require("ora");

const npm = require("./npm");
const api = require("./api");
const install = require("./install");
const publish = require("./publish");

function createPreset(options = {}) {
  options = {
    port: options.port || 5000,
    registryDirPath:
      options.registryDirPath || resolvePath(process.cwd(), "./registry"),
    infoFile: "info.json",
    proxies: options.proxies || [
      { name: "*", host: "https://registry.npmjs.org" },
    ],
    spinner: ora(),
  };

  const handlers = {
    // For start command
    initialStart: initialStart.bind(null, options),
    listenServer: listenServer.bind(null, options),
    beforeHandleRequest: beforeHandleRequest.bind(null, options),
    handleNpm: npm.bind(null, options),
    handleApi: api.bind(null, options),
    handleInstall: install.bind(null, options),
    handlePublish: publish.bind(null, options),
    handleBadRequest: handleBadRequest.bind(null, options),
    afterHandleRequest: afterHandleRequest.bind(null, options),
    handleError: handleError.bind(null, options),
  };

  return async function preset(key, ...args) {
    const handler = handlers[key];

    if (handler) {
      return await handler.apply(null, args);
    }

    return null;
  };
}

async function initialStart({ port }) {
  return { port };
}

async function listenServer({ port }) {
  console.log(`Server started on http://localhost:${port}`);
}

async function beforeHandleRequest({ spinner }, req) {
  spinner.start(`${req.method} ${req.url}`);
}

async function handleBadRequest({ spinner }, _, res) {
  spinner.fail();
  res.statusCode = 400;
  res.end();
}

async function afterHandleRequest({ spinner }, req) {
  if (req.url === "/-/npm/v1/security/audits/quick") {
    spinner.succeed(req.headers["referer"] || "");
  }
}

async function handleError({ spinner }, error, { res }) {
  spinner.fail();
  console.log(error);
  res.statusCode = 400;
  res.end();
}

module.exports = createPreset;
