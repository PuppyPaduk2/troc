import * as http from "http";
import * as path from "path";

import { Config as RegistryConfig, Registry } from "../utils/registry";
import {
  createRequestEventHandler,
  RequestEventHandler,
} from "../utils/request-event-handler";
import { createRequestHandler, RequestHandler } from "../utils/request-handler";
import { npmCommandHandlers } from "./request-event-handlers/npm-command";

export const createServer = (config: {
  storageDir: string;
  registries: RegistryConfig[];
  requestEventHandlers?: {
    before: RequestEventHandler[];
    after: RequestEventHandler[];
  };
}): {
  server: http.Server;
  requestHandler: RequestHandler;
} => {
  const server = http.createServer();
  const requestHandler = createRequestHandler({
    registries: createRegistries({
      registries: config.registries,
      storageDir: path.resolve(__dirname, config.storageDir ?? __dirname),
    }),
    requestEventHandlers: [
      ...(config.requestEventHandlers?.before ?? []),
      createRequestEventHandler({
        ...npmCommandHandlers.view,
        ...npmCommandHandlers.install,
        ...npmCommandHandlers.publish,
      }),
      ...(config.requestEventHandlers?.after ?? []),
    ],
  });
  server.addListener("request", requestHandler);
  return { server, requestHandler };
};

const createRegistries = (params: {
  storageDir: string;
  registries: RegistryConfig[];
}): Registry[] =>
  params.registries.map(toRegistry.bind(null, params.storageDir));

const toRegistry = (storageDir: string, config: RegistryConfig): Registry =>
  new Registry({
    ...config,
    dir: path.resolve(storageDir, config.dir),
  });
