const { readFile, writeFile, access, unlink } = require("fs/promises");
const { resolve: resolvePath, parse: parsePath } = require("path");
const semver = require("semver");

const { spawn } = require("../../spawn");

async function handler(options, packageJson) {
  const { baseDir, port, preId } = options;
  const path = resolvePath(baseDir, packageJson);
  const revertVersion = await upVersionPackage(options, path);
  const npmRc = resolvePath(baseDir, parsePath(path).dir, ".npmrc");
  const revertNpmRc = await changeNpmRc({ path: npmRc, port });

  await publish({ preId, path });
  await revertVersion();
  await revertNpmRc();
}

async function upVersionPackage({ registryDir, infoFile, preId }, path) {
  const raw = (await readFile(path)).toString();
  const json = JSON.parse(raw);
  const infoPath = resolvePath(registryDir, json.name, infoFile);
  const info = JSON.parse((await readFile(infoPath)).toString());
  const version = info["dist-tags"][preId] || json.version;

  json.version = semver.inc(version, "prerelease", preId);
  await writeFile(path, JSON.stringify(json, null, 2));

  return async () => {
    await writeFile(path, raw);
  };
}

async function changeNpmRc({ path, port }) {
  const raw = await readNpmRc(path);

  await writeFile(path, `registry=http://localhost:${port}\n`);

  return async () => {
    if (raw === null) {
      await unlink(path);
    } else {
      await writeFile(path, raw);
    }
  };
}

async function readNpmRc(path) {
  try {
    await access(path);
    return await readFile(path);
  } catch {
    return null;
  }
}

async function publish({ preId, path }) {
  await spawn("npm", ["publish", "--tag", preId], { cwd: parsePath(path).dir });
}

module.exports = handler;
