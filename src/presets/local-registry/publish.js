const { join: joinPath, parse: parsePath } = require("path");
const { mkdir, access, writeFile, readFile } = require("fs/promises");
const { recursive: recursiveMerge } = require("merge");

const { reqPromise } = require("../../req-promise");
const { joinChunks } = require("../../join-chunks");

async function handler(options, req, res) {
  const info = await takeInfo(req);
  const version = await takePackageVersion(info);

  await writeTarball({ options, req, res, info, version });
  await writeInfo({ options, req, res, info, version });
  res.end();
}

async function takeInfo(req) {
  const chunks = await reqPromise(req);
  const data = await joinChunks(chunks);
  return JSON.parse(data);
}

async function takePackageVersion(info) {
  const tag = Object.keys(info["dist-tags"])[0];
  const version = info["dist-tags"][tag];
  return info.versions[version];
}

async function writeInfo({ options, req, info }) {
  const { registryDirPath, infoFile } = options;
  const url = decodeURIComponent(req.url);
  const dirPath = joinPath(registryDirPath, url);
  const filePath = joinPath(dirPath, infoFile);
  const nextInfo = await buildInfo({ filePath, info });

  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, JSON.stringify(nextInfo, null, 2));
}

async function writeTarball({ options, version, info }) {
  const { registryDirPath } = options;
  const pathname = parsePath(new URL(version.dist.tarball).pathname);
  const dirPath = joinPath(registryDirPath, pathname.dir);
  const filePath = joinPath(dirPath, pathname.base);
  const { data } = info._attachments[pathname.base];

  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, data, "base64");
}

async function buildInfo({ filePath, info }) {
  const prevInfo = await readInfo(filePath);
  const nextInfo = recursiveMerge({}, prevInfo || {}, info);
  delete nextInfo._attachments;
  return nextInfo;
}

async function readInfo(path) {
  try {
    await access(path);
    const rawData = await readFile(path);
    return JSON.parse(rawData.toString());
  } catch {
    return null;
  }
}

module.exports = handler;
