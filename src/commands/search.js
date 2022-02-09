const ora = require("ora");
const { globPromise } = require("../glob-promise");
const { oraPromise } = require("../ora-promise");
const {
  checkStateFile,
  readState,
  writeState,
  setPackages,
  getPackages,
} = require("../state");

async function search() {
  const isInit = await checkStateFile();

  if (isInit) {
    const packages = await oraPromise(searchPackages(), "Search packages");
    await oraPromise(writePackagesToState(packages), "Write packages to state");
    await oraPromise(createCommitWithState(), "Create commit for state");
    await oraPromise(attachPackageToRegistry(), "Attach packages to registry");
  } else {
    ora().fail("Please init troc (run command: troc init).");
  }
}

async function searchPackages() {
  const cwd = process.cwd();
  const ignore = ["**/node_modules/**", "package.json"];
  const packages = await globPromise("**/package.json", { cwd, ignore });

  return packages;
}

async function writePackagesToState(packages = []) {
  await readState();
  await setPackages(packages);
  await writeState();
}

async function createCommitWithState() {}

async function attachPackageToRegistry() {
  const packages = await getPackages();

  for (let index = 0; index < packages.length; index += 1) {
    const packageJsonFile = packages[index];
    const need = await needAttachPackage(packageJsonFile);

    if (need) {
      await oraPromise(
        attachPackage(packageJsonFile),
        `Attach package: ${packageJsonFile}`
      );
    }
  }
}

async function needAttachPackage(packageJsonFile) {
  return true;
}

async function attachPackage(packageJsonFile) {}

module.exports = { search };
