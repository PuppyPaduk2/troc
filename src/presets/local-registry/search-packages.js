const { resolve: resolvePath } = require("path");

const { globPromise } = require("../../glob-promise");

async function handler(options = {}) {
  const { baseDir, packages, ignore: ignorePaths } = options;
  const promises = packages.map((value) => {
    const cwd = resolvePath(baseDir, value);
    const ignore = ["**/node_modules/**", ...ignorePaths];
    return globPromise("**/package.json", { cwd, ignore });
  });
  const results = (await Promise.all(promises)).map((paths, index) => {
    return paths.map((path) => resolvePath(baseDir, packages[index], path));
  });
  const uniq = Array.from(new Set(results.flat()));

  return uniq;
}

module.exports = handler;
