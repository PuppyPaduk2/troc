import { createProxyServer } from "./create-proxy-server";

const port = 4000;

(async () => {
  console.log("Starting server...");

  const proxyScopeUrls: Record<string, string[]> = {
    "@types": ["http://0.0.0.0:5002/npm", "https://registry.npmjs.org"],
  };
  const proxyCommandUrls: Record<string, string[]> = {
    install: ["http://0.0.0.0:5001/npm"],
  };
  const proxyAllUrls: string[] = [
    "http://0.0.0.0:5001/npm",
    "http://0.0.0.0:5002/npm",
    "https://registry.npmjs.org",
  ];

  const server = await createProxyServer({
    proxyScopeUrls,
    proxyCommandUrls,
    proxyAllUrls,
  });

  server.listen(port);

  console.log(`Server started http://localhost:${port}`);
})();
