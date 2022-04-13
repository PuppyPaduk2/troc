import * as path from "path";

import { RegistryServer } from "./registry-server";
import { ServerConfig } from "./utils/server-config";

(async () => {
  const port = 5000;
  const storageDir = path.join(__dirname, "registry-storage");
  const registryServer = new RegistryServer({
    config: new ServerConfig({ storageDir }),
    // commandHandlers: {
    //   whoami: NpmServer.createHandlerPipe([
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
