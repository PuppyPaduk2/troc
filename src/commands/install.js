const { readFile } = require("fs/promises");

const { runPresets } = require("../config");
const { start } = require("./start");

async function install(tag) {
  const registryPackages = (await runPresets("takeRegistryPackages")).flat();
  const packages = (await runPresets("searchPackages")).flat();
  const server = await start();

  try {
    await eachPackage({ tag, registryPackages, packages });
    await runPresets("installedPackages");
  } catch (error) {
    console.log(error);
  }

  server.close();
}

async function eachPackage(params = {}) {
  const { tag, registryPackages = [], packages = [] } = params;
  const registryPackageJsons = await getRegistryPackageJsons(registryPackages);

  for (let index = 0; index < packages.length; index += 1) {
    const path = packages[index];
    const raw = (await readFile(path)).toString();
    const json = JSON.parse(raw);
    const types = ["dependencies", "devDependencies", "peerDependencies"];

    await Promise.all(
      types.map((type) => {
        return installPackage({ tag, type, registryPackageJsons, path, json });
      })
    );
  }
}

async function getRegistryPackageJsons(paths = []) {
  const jsons = new Map();

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const raw = (await readFile(path)).toString();
    const json = JSON.parse(raw);

    jsons.set(json.name, json);
  }

  return jsons;
}

async function installPackage(params = {}) {
  const { tag, type, registryPackageJsons = new Map(), path, json } = params;
  const entries = Object.entries(json[type] ?? {});
  const packagesNeedUpdate = [];

  for (let index = 0; index < entries.length; index += 1) {
    const [name, version] = entries[index];
    const info = registryPackageJsons.get(name);

    if (info) {
      packagesNeedUpdate.push([name, { version, info }]);
    }
  }

  if (packagesNeedUpdate.length) {
    await runPresets("installPackage", {
      tag,
      type,
      packagesNeedUpdate,
      path,
      json,
    });
  }
}

module.exports = { install };
