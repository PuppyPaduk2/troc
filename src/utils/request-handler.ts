import * as http from "http";

import { Registry } from "./registry";
import { RequestEvent } from "./request-event";
import { RequestEventHandler, ResponseCallback } from "./request-event-handler";
import { sendBadRequest, sendNotFound } from "./response";

export const createRequestHandler =
  (options: CreateRequestHandlerOptions): RequestHandler =>
  async (request, response) => {
    const requestEvent = RequestEvent.create({
      registries: options.registries,
      url: request.url,
      referer: request.headers.referer,
    });
    if (requestEvent === null) return sendBadRequest(response)();

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
