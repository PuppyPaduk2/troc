async function handler(_, _, res) {
  res.statusCode = 401;
  res.end();
}

module.exports = handler;
