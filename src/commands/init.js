const { mkdir, access } = require("fs/promises");
const { oraPromise } = require("../ora-promise");
const { spawn } = require("../spawn");
const { registryDirPath } = require("../config");

async function init() {
  await oraPromise(createRegistry(), "Create registry");
  await oraPromise(initGitRepo(), "Init git repo");
}

async function createRegistry() {
  try {
    await access(registryDirPath);
  } catch {
    await mkdir(registryDirPath);
  }
}

async function initGitRepo() {
  const cwd = registryDirPath;
  await spawn("git", ["init"], { cwd });
}

module.exports = { init };
