const { createServer } = require("http");

const { runPresets } = require("../config");

const handlers = [
  {
    guard: (req) => req.url.startsWith("/npm"),
    handler: (req, res) => runPresets("handleNpm", req, res),
  },
  {
    guard: (req) => req.url.startsWith("/-"),
    handler: (req, res) => runPresets("handleApi", req, res),
  },
  {
    guard: (req) => req.method === "GET",
    handler: (req, res) => runPresets("handleInstall", req, res),
  },
  {
    guard: (req) => req.method === "PUT",
    handler: (req, res) => runPresets("handlePublish", req, res),
  },
];

async function start() {
  const [{ port }] = await runPresets("initialStart");

  return createServer(async (req, res) => {
    await runPresets("beforeHandleRequest", req, res);

    try {
      await handleRequest(req, res);
      await runPresets("afterHandleRequest", req, res);
    } catch (error) {
      await runPresets("handleError", error, { req, res });
    }
  }).listen(port, () => {
    runPresets("listenServer");
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
