const { createServer } = require("http");
const { createReadStream } = require("fs");
const { writeFile, access, readFile } = require("fs/promises");
const { join: joinPath, parse: parsePath } = require("path");
const { registryDirPath, config } = require("../config");
const { createDir } = require("../crate-dir");
const { reqPromise } = require("../req-promise");
const { joinChunks } = require("../join-chunks");
const { requestHttps } = require("../request-https");
const { recursive: recursiveMerge } = require("merge");
const { match: createMatch } = require("path-to-regexp");

const handlers = [
  { guard: isNpm, handler: sendNpm },
  { guard: isPublishPackage, handler: publishPackage },
  { guard: isInstall, handler: installPackage },
];

function start() {
  createServer(async (req, res) => {
    await serverHandler(req, res);
  }).listen(config.port, () => {
    console.log(`Server started on http://localhost:${config.port}`);
  });
}

async function serverHandler(req, res) {
  for (let index = 0; index < handlers.length; index += 1) {
    const { guard, handler } = handlers[index];

    if (await guard(req, res)) {
      return await handler(req, res);
    }
  }

  await sendBadRequest(req, res);
}

async function sendBadRequest(req, res) {
  console.log(req.method, req.url);
  // console.log(req.headers);

  res.statusCode = 400;
  res.end();
}

async function isNpm(req) {
  return req.method === "GET" && req.url.startsWith("/npm");
}

async function isPublishPackage(req) {
  return req.method === "PUT";
}

async function isInstall(req) {
  return req.method === "GET";
}

async function sendNpm(_, res) {
  res.end();
}

async function installPackage(req, res) {
  if (await checkPackageLocal(req)) {
    await installLocalPackage(req, res);
  } else {
    await installProxyPackage(req, res);
  }

  // const { host } = await takeProxy(req);

  // console.log(isRegistry, host);
  // const chunks = await requestHttps("https://registry.npmjs.org", {
  //   method: "GET",
  //   path: req.url,
  // });
  // const data = await joinChunks(chunks);

  // res.end(data);
}

async function checkPackageLocal(req) {
  const dirPath = await getPackageDirPath(req);

  try {
    await access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function installLocalPackage(req, res) {
  const filePath = await getPackageFilePath(req);

  console.log(filePath);

  try {
    await access(filePath);
    createReadStream(filePath).pipe(res);
  } catch {
    // pass
  }
}

async function getPackageFilePath(req) {
  const url = await getReqUrl(req);
  const dirPath = await getPackageDirPath(req);

  if (url.ext) {
    return joinPath(dirPath, url.base);
  } else {
    return joinPath(dirPath, config.packageInfoFile);
  }
}

async function getPackageDirPath(req) {
  const url = await getReqUrl(req);

  if (url.ext) {
    return joinPath(registryDirPath, url.dir);
  } else {
    return joinPath(registryDirPath, url.dir, url.name);
  }
}

async function getReqUrl(req) {
  return parsePath(decodeURIComponent(req.url || ""));
}

async function installProxyPackage(req, res) {
  const { host } = await takeProxy(req);

  try {
    const chunks = await requestHttps(host, {
      method: "GET",
      path: req.url,
    });
    const data = await joinChunks(chunks);

    res.write(data);
    res.end();
  } catch {
    res.statusCode = 400;
    res.end();
  }
}

async function takeProxy(req) {
  const url = decodeURIComponent(req.url || "");

  for (let index = 0; index < config.proxy.length; index += 1) {
    const { name, host } = config.proxy[index];
    const match = createMatch(name.replace("*", "(.*)"));

    if (match(url)) {
      return { name, host };
    }
  }
}

async function publishPackage(req, res) {
  const packageJson = await getPackageJson(req);
  const version = await getPackageVersion(packageJson);

  await createPackageDir(version);
  await writePackageTarball({ packageJson, version });
  await writePackageInfo({ packageJson, version });

  res.end();
}

async function getPackageJson(req) {
  const chunks = await reqPromise(req);
  const data = await joinChunks(chunks);
  return JSON.parse(data);
}

async function createPackageDir(version) {
  const tarballURL = new URL(version.dist.tarball);
  const tarballDir = parsePath(tarballURL.pathname).dir;
  const tarballDirPath = joinPath(registryDirPath, tarballDir);

  await createDir(tarballDirPath);
}

async function writePackageTarball({ packageJson, version }) {
  const tarballURL = new URL(version.dist.tarball);
  const tarballFile = parsePath(tarballURL.pathname).base;
  const tarballFilePath = joinPath(registryDirPath, tarballURL.pathname);
  const tarballData = packageJson._attachments[tarballFile].data;

  await writeFile(tarballFilePath, tarballData, "base64");
}

async function getPackageVersion(packageJson) {
  const tag = Object.keys(packageJson["dist-tags"])[0];
  const version = packageJson["dist-tags"][tag];
  return packageJson.versions[version];
}

async function writePackageInfo({ packageJson, version }) {
  const packageInfoPath = await getPackageInfoPathByVersion(version);
  const prevInfo = await readPackageInfo(packageInfoPath);
  const nextInfo = recursiveMerge({}, prevInfo || {}, packageJson);

  delete nextInfo._attachments;
  await writeFile(packageInfoPath, JSON.stringify(nextInfo, null, 2));
}

async function readPackageInfo(packageInfoPath) {
  try {
    await access(packageInfoPath);
    const rawData = await readFile(packageInfoPath);
    return JSON.parse(rawData.toString());
  } catch {
    return null;
  }
}

async function getPackageInfoPathByVersion(version) {
  const tarballURL = new URL(version.dist.tarball);
  const packageDir = parsePath(tarballURL.pathname).dir.replace("/-", "");
  return joinPath(registryDirPath, packageDir, config.packageInfoFile);
}

module.exports = { start };
