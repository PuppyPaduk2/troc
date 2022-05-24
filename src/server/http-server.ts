import * as http from "http";
import { RegistryNext, RegistryUrl } from "./registry";

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
