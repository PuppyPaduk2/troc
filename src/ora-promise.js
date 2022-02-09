const ora = require("ora");

function oraPromise(promise, message) {
  ora.promise(promise, message);

  return promise;
}

module.exports = { oraPromise };
