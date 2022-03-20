import { createNpmProxyServer } from "./npm-proxy-server";

const port = 4000;

(async () => {
  const proxy: string[] = [
    "http://0.0.0.0:5001/npm",
    "http://0.0.0.0:5002/npm",
    "https://registry.npmjs.org",
  ];
  const result = await createNpmProxyServer({ port, proxy });

  if ("error" in result) {
    console.log(result.error);
    return;
  }

  console.log(`Server created http://localhost:${port}`);
})();
