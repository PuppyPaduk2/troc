import * as path from "path";
import { formatPackageInfo } from "./hooks";

import { createHttpServer as createHttpServerRoot } from "./http-server";
import { Registry } from "./registry";

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
      // commands: ["install", "view"],
      exclude: { names: ["pack", "pack-1"] },
    },
  ],
  hooks: { formatPackageInfo },
});
const protectedRegistry = new Registry({
  url: "/protected",
  dir: path.join(dir, "protected"),
  proxyConfigs: [],
  hooks: {},
});
const protectedMyRegistry = new Registry({
  url: "/protected/my",
  dir: path.join(dir, "protected-my"),
  proxyConfigs: [],
  hooks: {},
});
const proxyServer = createHttpServerRoot({
  registries: new Map([
    ["", rootRegistry],
    ["/protected", protectedRegistry],
    ["/protected/my", protectedMyRegistry],
  ]),
  // hooks: {
  //   formatPackageInfo,
  // },
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
