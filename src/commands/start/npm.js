async function guard(req) {
  return req.method === "GET" && req.url.startsWith("/npm");
}

async function handler(_, res) {
  res.end();
}

module.exports = { guard, handler };
