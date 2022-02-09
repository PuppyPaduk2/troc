const cp = require("child_process");

function spawn(command, args = [], config = {}) {
  return new Promise((resolve, reject) => {
    const processSpawn = cp.spawn(command, args, config);
    const result = { log: [], error: [] };

    processSpawn.stdout.on("data", (data) => {
      result.log.push(data.toString());
    });
    processSpawn.stderr.on("data", (data) => {
      result.error.push(data.toString());
    });
    processSpawn.on("close", (code) => {
      if (code === 0) {
        resolve(result.log.join("\n"));
      } else {
        reject(result.error.join("\n"));
      }
    });
  });
}

module.exports = { spawn };
