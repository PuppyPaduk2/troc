import * as path from "path";

import { ProxyServer } from "./proxy-server";
import { ServerConfig } from "./utils/v2/server-config";

(async () => {
  const port = 4000;
  const storageDir = path.join(__dirname, "proxy-storage-next");
  const registryServer = new ProxyServer({
    config: new ServerConfig({ storageDir }),
    proxies: [
      // {
      //   url: "http://0.0.0.0:5001/npm",
      //   names: ["webpack"],
      //   commands: ["install"],
      // },
      // {
      //   url: "http://0.0.0.0:5002/npm",
      //   scopes: ["@types"],
      // },
      // {
      //   url: "http://0.0.0.0:5002/npm",
      //   scopes: ["@babel"],
      // },
      // {
      //   url: "http://0.0.0.0:5003",
      //   names: ["react", "react-dom"],
      // },
      // {
      //   url: "https://registry.npmjs.org",
      //   scopes: ["@types"],
      // },
      // {
      //   url: "http://0.0.0.0:5005",
      // },
      // {
      //   url: "http://localhost:5000",
      //   names: ["pack-1"],
      // },
      {
        url: "http://0.0.0.0:5000",
        names: ["pack", "pack-1"],
      },
      {
        url: "https://registry.npmjs.org",
        commands: ["install"],
        exclude: { names: ["pack", "pack-1"] },
      },
    ],
  });

  await registryServer.readData();
  registryServer.server.addListener("listening", () => {
    console.log(`Server started http://localhost:${port}`);
  });
  registryServer.server.listen(port);
})();
