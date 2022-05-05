import * as path from "path";
import { Adapter } from "./adapter";
import { formatPackageInfo } from "./hooks";

import { createHttpServer as createHttpServerRoot } from "./http-server";
import { Registry, RegistryParams } from "./registry";

const proxyPort = 4000;
const dir = path.join(__dirname, "storage-root");
const config: {
  registries: RegistryParams<Adapter>[];
} = {
  registries: [
    {
      url: "",
      dir: path.join(dir, "__root__"),
      proxyConfigs: [
        {
          url: "https://registry.npmjs.org",
          commands: ["install", "view"],
          exclude: { names: ["pack", "pack-1"] },
        },
        {
          url: "http://0.0.0.0:4000/protected",
          names: ["pack", "pack-1"],
        },
      ],
      hooks: { formatPackageInfo },
    },
    {
      url: "/protected",
      dir: path.join(dir, "protected"),
      proxyConfigs: [],
      hooks: {},
    },
    {
      url: "/protected/my",
      dir: path.join(dir, "protected-my"),
      proxyConfigs: [],
      hooks: {},
    },
  ],
};
const registries = config.registries.map<[string, Registry<Adapter>]>(
  (registryConfig) => [registryConfig.url, new Registry(registryConfig)]
);
const proxyServer = createHttpServerRoot({ registries: new Map(registries) });

Promise.allSettled(registries).then(() => {
  proxyServer.addListener("listening", () => {
    console.log(`Server started http://localhost:${proxyPort}`);
  });
  proxyServer.listen(proxyPort);
});
