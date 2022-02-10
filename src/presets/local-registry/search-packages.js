const { resolve: resolvePath } = require("path");

const { globPromise } = require("../../glob-promise");

async function handler({ baseDir, packages, ignore }) {
  const promises = packages.map((value) => {
    return globPromise("**/package.json", {
      cwd: resolvePath(baseDir, value),
      ignore: ["**/node_modules/**", ...ignore],
    });
  });
  const results = (await Promise.all(promises)).map((paths, index) => {
    return paths.map((path) => resolvePath(packages[index], path));
  });
  const uniq = Array.from(new Set(results.flat()));

  return uniq;
}

module.exports = handler;
