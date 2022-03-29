import { Server } from "net";
import * as path from "path";

import { ServerConfig } from "../create-server/config";

export const npmUrl = "https://registry.npmjs.org";
export const defPort = 4000;
export const defHostname = "0.0.0.0";
export const defProtocol = "http:";
export const npmrcName = ".npmrc";
export const npmrcCopyName = ".npmrc-copy";
export const defStorageDir = path.resolve(__dirname, "./storage");

export type CommonOptions = {
  port?: string;
  hostname?: string;
  protocol?: string;
  proxy?: string[];
  proxyNpm?: boolean;
  storageDir?: string;
};

export function getServerConfig(options: CommonOptions): Partial<ServerConfig> {
  return {
    proxyAllUrls: [
      ...(options.proxy ?? []),
      options.proxyNpm ? npmUrl : "",
    ].filter(Boolean),
    storageDir: path.resolve(
      process.cwd(),
      options.storageDir ?? defStorageDir
    ),
  };
}

export async function runServer(
  server: Server,
  port: number,
  hostname?: string,
  protocol?: string
): Promise<Server | Error> {
  return new Promise<Server | Error>((resolve) => {
    server.on("listening", () => {
      console.log(`Listen ${protocol}//${hostname}:${port}`);
      resolve(server);
    });

    server.on("error", () => {
      const message = "Starting server error";

      console.log(message);
      resolve(new Error(message));
    });

    server.listen(port, hostname);
  });
}
