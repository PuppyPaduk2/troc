import { createServer } from "http";
import * as path from "path";

import { RegistryServer } from "./registry-server";

(async () => {
  const port = 4000;
  const registryServer = new RegistryServer({
    server: createServer(),
    storageDir: path.join(__dirname, "reg"),
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
