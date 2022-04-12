import * as path from "path";

import { RegistryServer } from "./create-registry-server/v2";
import { ServerConfig } from "./utils/v2/server-config";

(async () => {
  const port = 4000;
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
