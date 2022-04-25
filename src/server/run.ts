import * as path from "path";
import { formatterPackageInfo } from "./proxy/hooks";

import { createHttpServer as createHttpServerRegistry } from "./registry/http-server";
import { createHttpServer } from "./proxy/http-server";

const registryPort = 5000;
const registryServer = createHttpServerRegistry({
  storageDir: path.join(__dirname, "storage-registry"),
});

registryServer.addListener("listening", () => {
  console.log(`Server started http://localhost:${registryPort}`);
});
registryServer.listen(registryPort);

const proxyPort = 4000;
const proxyServer = createHttpServer({
  storageDir: path.join(__dirname, "storage-proxy"),
  registries: {
    "/protected": {},
    "": {},
  },
  proxyConfigs: [
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
  hooks: {
    formatterPackageInfo,
  },
});

proxyServer.addListener("listening", () => {
  console.log(`Server started http://localhost:${proxyPort}`);
});
proxyServer.listen(proxyPort);
