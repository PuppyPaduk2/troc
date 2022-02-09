const { request } = require("https");

async function requestHttps(url, options) {
  return new Promise((resolve, reject) => {
    const proxyRequest = request(url, options);
    const chunks = [];

    proxyRequest.on("response", (message) => {
      message.on("data", (chunk) => {
        chunks.push(chunk);
      });
      message.on("end", async () => {
        resolve(chunks);
      });
    });
    proxyRequest.on("error", (error) => {
      reject(error);
    });
    proxyRequest.end();
  });
}

module.exports = { requestHttps };
