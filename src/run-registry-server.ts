import * as path from "path";

import { createRegistryServer } from "./create-registry-server";
import { DataStorage } from "./utils/data-storage";
import { ServerConfig } from "./utils/server-config";

const port = 5000;

(async () => {
  console.log("Starting server...");

  const serverConfig = new ServerConfig({
    storageDir: path.join(__dirname, "my-storage"),
  });
  const dataStorage = new DataStorage(
    {
      users: await serverConfig.readUsers(),
      tokens: await serverConfig.readTokens(),
    },
    {
      onChange: async (name) => {
        if (name === "users") {
          await serverConfig.writeUsers(await dataStorage.users.serialize());
        } else if (name === "tokens") {
          await serverConfig.writeTokens(await dataStorage.tokens.serialize());
        }
      },
    }
  );
  const server = createRegistryServer({ serverConfig, dataStorage });

  server.listen(port);
  console.log(`Server started http://localhost:${port}`);
})();
