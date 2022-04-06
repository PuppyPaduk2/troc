import * as path from "path";

import { createProxyServer } from "./create-proxy-server-v2";
import { DataStorage } from "./utils/data-storage";
import { ServerConfig } from "./utils/server-config";

const port = 4000;

(async () => {
  console.log("Starting server...");

  const serverConfig = new ServerConfig({
    storageDir: path.join(__dirname, "proxy-storage"),
    proxies: [
      {
        url: "http://0.0.0.0:5001/npm",
        names: ["webpack"],
        commands: ["install"],
      },
      {
        url: "http://0.0.0.0:5002/npm",
        scopes: ["@types"],
      },
      {
        url: "http://0.0.0.0:5002/npm",
        scopes: ["@babel"],
      },
      {
        url: "http://0.0.0.0:5003",
        names: ["react", "react-dom"],
      },
      {
        url: "https://registry.npmjs.org",
        scopes: ["@types"],
      },
      {
        url: "http://0.0.0.0:5005",
      },
      {
        url: "http://localhost:5000",
      },
      {
        url: "https://registry.npmjs.org",
        commands: ["install"],
      },
    ],
  });
  const dataStorage = new DataStorage(
    {
      users: await serverConfig.readUsers(),
      tokens: await serverConfig.readTokens(),
      registryTokens: await serverConfig.readRegistryTokens(),
    },
    {
      onChange: async (name) => {
        if (name === "users") {
          await serverConfig.writeUsers(await dataStorage.users.serialize());
        } else if (name === "tokens") {
          await serverConfig.writeTokens(await dataStorage.tokens.serialize());
        } else if (name === "registryTokens") {
          await serverConfig.writeRegistryTokens(
            await dataStorage.registryTokens.serialize()
          );
        }
      },
    }
  );
  const server = createProxyServer({ serverConfig, dataStorage });

  server.listen(port);

  console.log(`Server started http://localhost:${port}`);
})();
