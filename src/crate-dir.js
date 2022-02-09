const { access, mkdir } = require("fs/promises");

async function createDir(path) {
  try {
    await access(path);
    return false;
  } catch {
    await mkdir(path, { recursive: true });
    return true;
  }
}

module.exports = { createDir };
