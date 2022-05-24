import * as http from "http";
// import { Adapter } from "./adapter";
// import { Registry, RegistryUrl } from "./registry";
import { RegistryNext, RegistryUrl } from "./registry-next";

import { createServerHandlers } from "./server-handlers";

export const createHttpServer = (options: {
  registries: Map<RegistryUrl, RegistryNext>;
}): http.Server => {
  const { registries } = options;
  const server = http.createServer();
  const { listening, request } = createServerHandlers({ registries });

  server.addListener("listening", listening);
  server.addListener("request", request);

  return server;
};
