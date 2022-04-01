import * as path from "path";

import { createRegistryServer } from "./create-registry-server";
import { InfraStorage } from "./utils/infra-storage";
import { ServerConfig } from "./utils/server-config";

const port = 5000;

(async () => {
  console.log("Starting server...");

  const serverConfig = new ServerConfig({
    storageDir: path.join(__dirname, "my-storage"),
  });
  const infraStorage = new InfraStorage({ serverConfig });

  await infraStorage.readUsers();
  await infraStorage.readTokens();

  const server = createRegistryServer({ serverConfig, infraStorage });

  server.listen(port);
  console.log(`Server started http://localhost:${port}`);
})();
