import {
  createServer as createHttpServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from "http";

import { Config as RegistryConfig, Registry } from "../utils/registry";
import { RequestEvent } from "../utils/request-event";
import { attachResponse } from "../utils/response";
import {
  npmCommandHandlers,
  RequestEventHandler,
} from "./request-event-handlers";
import { createHandler as createRequestEventHandlerPipe } from "./request-event-handlers/utils/request-event-handler";

export const createServer = (config: {
  registries: RegistryConfig[];
  requestEventHandlers?: {
    before: RequestEventHandler[];
    after: RequestEventHandler[];
  };
}): {
  server: Server;
  requestHandler: RequestHandler;
} => {
  const server = createHttpServer();
  const requestEventHandler = createRequestEventHandlerPipe([
    ...(config.requestEventHandlers?.before ?? []),
    npmCommandHandlers,
    ...(config.requestEventHandlers?.after ?? []),
  ]);
  const requestHandler: RequestHandler = async (request, response) => {
    const send = attachResponse(response);
    const event = RequestEvent.create({
      url: request.url,
      referer: request.headers.referer,
      registries: config.registries.map(Registry.create),
    });
    if (!event) return send.notFound();

    const responseCallback = await requestEventHandler({
      payload: { request, response },
      event,
    });
    if (responseCallback) return responseCallback();
    else return send.notFound();
  };
  server.addListener("request", requestHandler);
  return { server, requestHandler };
};

type RequestHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => Promise<void>;
