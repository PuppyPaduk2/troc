import { createServer } from "http";
import * as path from "path";

import { RegistryServer } from "./registry-server";
import { ServerConfig } from "./utils/server-config";

(async () => {
  const port = 5000;
  const registryServer = new RegistryServer({
    server: createServer(),
    config: new ServerConfig({
      storageDir: path.join(__dirname, "registry-storage"),
    }),
    // commandHandlers: {
    //   whoami: RegistryServer.createHandlerPipe([
    //     RegistryServer.log,
    //     RegistryServer.handleCommandWhoami,
    //   ]),
    // },
  });

  await registryServer.readData();
  registryServer.server.addListener("listening", () => {
    console.log(`Server started http://localhost:${port}`);
  });
  registryServer.server.listen(port);
})();
