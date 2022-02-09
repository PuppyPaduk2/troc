const { access, readFile, writeFile } = require("fs/promises");
const { stateFilePath } = require("./config");

const state = {
  packages: [],
};

async function checkStateFile() {
  try {
    await access(stateFilePath);
    return true;
  } catch {
    return false;
  }
}

async function readState() {
  const isExist = await checkStateFile();

  if (isExist) {
    const rawData = await readFile(stateFilePath);
    const data = JSON.parse(rawData.toString());

    state.packages = data.packages || [];
  }
}

async function writeState() {
  await writeFile(stateFilePath, JSON.stringify(state, null, 2));
}

async function setPackages(packages = []) {
  state.packages = [...packages];
}

async function getPackages() {
  return state.packages || [];
}

module.exports = {
  checkStateFile,
  readState,
  writeState,
  setPackages,
  getPackages,
};
