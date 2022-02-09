const { access } = require("fs/promises");
const { createReadStream } = require("fs");
const { join: joinPath, parse: parsePath } = require("path");
const { match: createMatch } = require("path-to-regexp");

const { registryDirPath, config } = require("../../config");
const { requestHttps } = require("../../request-https");
const { joinChunks } = require("../../join-chunks");

const { infoFile, proxies } = config;

async function guard(req) {
  return req.method === "GET";
}

async function handler(req, res) {
  try {
    await takeLocal(req, res);
  } catch {
    try {
      await takePublic(req, res);
    } catch {
      res.statusCode = 400;
      res.end();
    }
  }
}

async function takeLocal(req, res) {
  const { ext, dir, base } = parsePath(decodeURIComponent(req.url || ""));
  const path = joinPath(registryDirPath, dir, base, ext ? "" : infoFile);

  await access(path);
  createReadStream(path).pipe(res);
}

async function takePublic(req, res) {
  const path = decodeURIComponent(req.url || "");
  const { host } = await takeProxy(path);

  const chunks = await requestHttps(host, { method: "GET", path });
  const data = await joinChunks(chunks);

  res.write(data);
  res.end();
}

async function takeProxy(url) {
  for (let index = 0; index < proxies.length; index += 1) {
    const { name, host } = proxies[index];
    const match = createMatch(name.replace("*", "(.*)"));

    if (match(url)) {
      return { name, host };
    }
  }
}

module.exports = { guard, handler };
