function reqPromise(req) {
  const chunks = [];

  return new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("error", (error) => {
      reject(error);
    });
    req.on("end", async () => {
      resolve(chunks);
    });
  });
}

module.exports = { reqPromise };
