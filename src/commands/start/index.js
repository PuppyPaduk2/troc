const { createServer } = require("http");

const { config } = require("../../config");

const npm = require("./npm");
const install = require("./install");
const publish = require("./publish");

const { port } = config;
const handlers = [npm, install, publish];

function start() {
  return createServer(async (req, res) => {
    await handleRequest(req, res);
  }).listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
  });
}

async function handleRequest(req, res) {
  for (let index = 0; index < handlers.length; index += 1) {
    const { guard, handler } = handlers[index];

    if (await guard(req, res)) {
      return await handler(req, res);
    }
  }

  await handleBadRequest(req, res);
}

async function handleBadRequest(_, res) {
  res.statusCode = 400;
  res.end();
}

module.exports = { start };
