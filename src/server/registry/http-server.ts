import * as http from "http";

import {
  createServerHandlers,
  Options as ServerHandlersOptions,
} from "./server-handlers";

export const createHttpServer = (
  options: ServerHandlersOptions = {}
): http.Server => {
  const server = http.createServer();
  const { listening, request } = createServerHandlers(options);

  server.addListener("listening", listening);
  server.addListener("request", request);

  return server;
};
