import * as http from "http";

import { parseNpmCommand } from "./npm-command";
import { Registry } from "./registry";
import { RequestEvent } from "./request-event";
import { RequestEventHandler, ResponseCallback } from "./request-event-handler";
import {
  sendBadRequest,
  sendNotFound,
  SendWithAttachedResponse,
} from "./response";
import { parseUrl } from "./url";

export const createRequestHandler =
  (options: CreateRequestHandlerOptions): RequestHandler =>
  async (request, response) => {
    const { registries } = options;
    const requestEvent = createRequestEvent({
      registries,
      request,
      response,
    });
    if (requestEvent instanceof Function) return requestEvent();

    const { requestEventHandlers } = options;
    const responseCallback = await handleRequestEvent({
      requestEventHandlers,
      request,
      response,
      requestEvent,
    });
    if (responseCallback) return responseCallback();
    else return sendNotFound(response)();
  };

type CreateRequestHandlerOptions = {
  registries: Registry[];
  requestEventHandlers: RequestEventHandler[];
};

export type RequestHandler = (
  request: http.IncomingMessage,
  response: http.ServerResponse
) => Promise<void>;

const createRequestEvent = (params: {
  registries: Registry[];
  request: http.IncomingMessage;
  response: http.ServerResponse;
}): RequestEvent | SendWithAttachedResponse => {
  const { request, registries, response } = params;
  const parsedUrl = parseUrl(request.url);
  const registry = RequestEvent.findRegistry(registries, parsedUrl);
  if (!registry) return sendBadRequest(response);

  return new RequestEvent({
    npmCommand: parseNpmCommand(request.headers.referer),
    parsedUrl,
    registry,
  });
};

const handleRequestEvent = async (params: {
  requestEventHandlers: RequestEventHandler[];
  request: http.IncomingMessage;
  response: http.ServerResponse;
  requestEvent: RequestEvent;
}): Promise<ResponseCallback | null> => {
  const { requestEventHandlers, request, response, requestEvent } = params;
  for (const requestEventHandler of requestEventHandlers) {
    const responseCallback = await requestEventHandler(requestEvent, {
      request,
      response,
    });
    if (responseCallback) return responseCallback;
  }
  return null;
};
