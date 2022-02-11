const { parse: parsePath } = require("path");

const { spawn } = require("../../spawn");

const flags = {
  dependencies: "--save",
  devDependencies: "--save-dev",
  peerDependencies: "--save-peer",
};

async function handler(
  { preId, spinner },
  { tag, path, type, packagesNeedUpdate, json }
) {
  const currentTag = tag || preId;
  const cwd = parsePath(path).dir;
  const packageNames = packagesNeedUpdate.reduce((memo, [name, { info }]) => {
    if (info["dist-tags"][currentTag]) {
      memo.push(`${name}@${currentTag}`);
    }

    return memo;
  }, []);

  if (packageNames.length) {
    const flag = flags[type];
    const args = ["install", flag, ...packageNames, "--no-save"];

    await spawn("npm", args, { cwd });
    spinner.succeed(`Packages installed to "${json.name}" package`);
  }
}

module.exports = handler;
