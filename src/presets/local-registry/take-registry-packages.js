const { resolve: resolvePath } = require("path");

const { globPromise } = require("../../glob-promise");

async function handler({ registryDir, infoFile }) {
  const packages = await globPromise(`**/${infoFile}`, { cwd: registryDir });
  return packages.map((value) => resolvePath(registryDir, value));
}

module.exports = handler;
