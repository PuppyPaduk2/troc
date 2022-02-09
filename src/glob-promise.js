const glob = require("glob");

function globPromise(pattern, options) {
  return new Promise((resolve, reject) => {
    glob(pattern, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = { globPromise };
