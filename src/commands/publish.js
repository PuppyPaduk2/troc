const { runPresets } = require("../config");
const { start } = require("./start");

async function publish(tag) {
  const packages = (await runPresets("searchPackages")).flat();
  const server = await start();

  for (let index = 0; index < packages.length; index += 1) {
    const packageFile = packages[index];

    await runPresets("publishPackage", packageFile, { tag });
  }

  server.close();
  await runPresets("publishedPackages");
}

module.exports = { publish };
