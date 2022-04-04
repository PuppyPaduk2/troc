import { Server, createServer as createServerHttp } from "http";

import { ServerConfigParams } from "../utils/server-config";

export function createProxyServer(params: {
  serverConfig: ServerConfigParams;
}): Server {
  return createServerHttp(async () => {
    console.log("listening");
  });
}
