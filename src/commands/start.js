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

module.exports = { start };
