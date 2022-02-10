const { access } = require("fs/promises");
const { createReadStream } = require("fs");
const { join: joinPath, parse: parsePath } = require("path");
const { match: createMatch } = require("path-to-regexp");

const { requestHttps } = require("../../request-https");
const { joinChunks } = require("../../join-chunks");

async function handler(options, req, res) {
  if (!(await takeLocal(options, req, res))) {
    await takePublic(options, req, res);
  }
}

async function takeLocal({ registryDir, infoFile }, req, res) {
  const { ext, dir, base } = parsePath(decodeURIComponent(req.url || ""));
  const path = joinPath(registryDir, dir, base, ext ? "" : infoFile);

  try {
    await access(path);
    createReadStream(path).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function takePublic(options, req, res) {
  const path = decodeURIComponent(req.url || "");
  const { host } = await takeProxy(options, path);

  const chunks = await requestHttps(host, { method: "GET", path });
  const data = await joinChunks(chunks);

  res.write(data);
  res.end();
}

async function takeProxy({ proxies }, url) {
  for (let index = 0; index < proxies.length; index += 1) {
    const { name, host } = proxies[index];
    const match = createMatch(name.replace("*", "(.*)"));

    if (match(url)) {
      return { name, host };
    }
  }
}

module.exports = handler;
