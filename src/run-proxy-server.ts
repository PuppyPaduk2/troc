import * as path from "path";
import { createServer } from "http";

import { ProxyServer } from "./proxy-server";
import { ServerConfig } from "./utils/server-config";

(async () => {
  const port = 4000;
  const registryServer = new ProxyServer({
    server: createServer(),
    config: new ServerConfig({
      storageDir: path.join(__dirname, "proxy-storage-next"),
    }),
    proxies: [
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
