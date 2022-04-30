import * as http from "http";
import { Registry, RegistryUrl } from "./registry";

import { createServerHandlers } from "./server-handlers";

export const createHttpServer = (options: {
  registries: Map<RegistryUrl, Registry>;
}): http.Server => {
  const { registries } = options;
  const server = http.createServer();
  const { listening, request } = createServerHandlers({ registries });

  server.addListener("listening", listening);
  server.addListener("request", request);

  return server;
};
