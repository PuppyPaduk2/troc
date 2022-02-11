const { createServer } = require("http");

const { runPresets } = require("../config");

const handlers = [
  {
    guard: (req) => req.url.startsWith("/npm"),
    handler: (req, res) => runPresets("handleNpmRequest", req, res),
  },
  {
    guard: (req) => req.url.startsWith("/-"),
    handler: (req, res) => runPresets("handleApiRequest", req, res),
  },
  {
    guard: (req) => req.method === "GET",
    handler: (req, res) => runPresets("handleInstallRequest", req, res),
  },
  {
    guard: (req) => req.method === "PUT",
    handler: (req, res) => runPresets("handlePublishRequest", req, res),
  },
];

function start() {
  return new Promise(async (resolve) => {
    const [{ port }] = await runPresets("initialStart");
    const server = createServer(async (req, res) => {
      await runPresets("handlePreRequest", req, res);

      try {
        await handleRequest(req, res);
        await runPresets("handlePostRequest", req, res);
        await handlerCommandEnd(req, res);
      } catch (error) {
        await runPresets("handleErrorRequest", error, { req, res });
      }
    }).listen(port, async () => {
      await runPresets("listenServer");
      resolve(server);
    });
  });
}

async function handleRequest(req, res) {
  for (let index = 0; index < handlers.length; index += 1) {
    const { guard, handler } = handlers[index];

    if (await guard(req, res)) {
      return await handler(req, res);
    }
  }

  await runPresets("handleBadRequest", req, res);
}

async function handlerCommandEnd(req, res) {
  const commandType = takeCommandType(req);

  await runPresets("handleCommandEnd", { req, res, commandType });
}

function takeCommandType(req) {
  const referer = req.headers["referer"] || "";
  const isAudit = req.url === "/-/npm/v1/security/audits/quick";

  if (isAudit && referer.startsWith("install")) {
    return "install";
  } else if (isAudit && referer.startsWith("uninstall")) {
    return "uninstall";
  } else if (referer.startsWith("view")) {
    return "view";
  } else if (referer.startsWith("publish")) {
    return "publish";
  }
}

module.exports = { start };
