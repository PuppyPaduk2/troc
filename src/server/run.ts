import * as path from "path";

import { createHttpServer as createHttpServerRoot } from "./root/http-server";
import { Registry } from "./root/registry";

const proxyPort = 4000;
const dir = path.join(__dirname, "storage-root");
const rootRegistry = new Registry({
  url: "",
  dir: path.join(dir, "__root__"),
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
});
const protectedRegistry = new Registry({
  url: "/protected",
  dir: path.join(dir, "protected"),
  proxyConfigs: [],
});
const protectedMyRegistry = new Registry({
  url: "/protected/my",
  dir: path.join(dir, "protected-my"),
  proxyConfigs: [],
});
const proxyServer = createHttpServerRoot({
  registries: new Map([
    ["", rootRegistry],
    ["/protected", protectedRegistry],
    ["/protected/my", protectedMyRegistry],
  ]),
});

Promise.allSettled([
  rootRegistry.readCache(),
  protectedRegistry.readCache(),
  protectedMyRegistry.readCache(),
]).then(() => {
  proxyServer.addListener("listening", () => {
    console.log(`Server started http://localhost:${proxyPort}`);
  });
  proxyServer.listen(proxyPort);
});
