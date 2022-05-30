import * as path from "path";
import { formatPackageInfo } from "./hooks/next";

import { createHttpServer as createHttpServerRoot } from "./http-server";
import { RegistryNext, RegistryParams } from "./registry";

const proxyPort = 4000;
const dir = path.join(__dirname, "storage-root");
const config: {
  registries: Record<string, RegistryParams>;
} = {
  registries: {
    "": {
      dir: path.join(dir, "__root__"),
      proxyConfigs: [
        {
          url: "https://registry.npmjs.org",
          include: [
            "/(install|view)/(.*)",
            "/(install|view)/p3",
            "/(install|view)/@my/p3",
          ],
          exclude: ["/(install|view)/p1", "/(install|view)/@my/(.*)"],
        },
        {
          url: "http://localhost:4000/protected",
          include: [
            "/(install|view)/p1",
            "/(install|view)/@my/(.*)",
            "/(install|view)/p3",
          ],
        },
      ],
      hooks: { formatPackageInfo },
    },
    "/protected": {
      dir: path.join(dir, "protected"),
      proxyConfigs: [
        {
          url: "http://localhost:4000/protected/my",
          include: [
            "/(install|view|publish)/p1",
            "/(install|view|publish)/@my/(.*)",
            "/(install|view|publish)/p3",
          ],
        },
      ],
      hooks: {},
    },
    "/protected/my": {
      dir: path.join(dir, "protected-my"),
      proxyConfigs: [],
      hooks: {},
    },
    "/custom": {
      dir: path.join(dir, "custom"),
      proxyConfigs: [],
      hooks: {},
    },
  },
};
const registries = Object.entries(config.registries).map<
  [string, RegistryNext]
>(([url, registryConfig]) => [url, new RegistryNext(registryConfig)]);
const proxyServer = createHttpServerRoot({ registries: new Map(registries) });

proxyServer.addListener("listening", () => {
  console.log(`Server started http://localhost:${proxyPort}`);
});
proxyServer.listen(proxyPort);
