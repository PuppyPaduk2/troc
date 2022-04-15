import { createServer } from "http";
import * as path from "path";

import { RegistryServer } from "./registry-server";

(async () => {
  const port = 5000;
  const registryServer = new RegistryServer({
    server: createServer(),
    storageDir: path.join(__dirname, "registry-storage"),
    // commandHandlers: {
    //   whoami: RegistryServer.createHandlerPipe([
    //     RegistryServer.log,
    //     RegistryServer.handleCommandWhoami,
    //   ]),
    // },
  });

  registryServer.server.addListener("listening", () => {
    console.log(`Server started http://localhost:${port}`);
  });
  registryServer.server.listen(port);
})();
