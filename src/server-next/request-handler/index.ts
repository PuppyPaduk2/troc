import * as http from "http";

import { Registry } from "../../utils/registry";
import { sendBadRequest, sendNotFound } from "../../utils/response";
import { getRequestEvent } from "./request-event";
import {
  RequestEventHandler,
  ResponseCallback,
} from "./request-event-handler/types";

type RequestHandlerOptions = {
  registries: Registry[];
  requestEventHandlers: RequestEventHandler[];
};

export const createRequestHandler =
  (options: RequestHandlerOptions) =>
  async (request: http.IncomingMessage, response: http.ServerResponse) => {
    const requestEvent = getRequestEvent(request, options);
    if (requestEvent instanceof Error) {
      console.log(requestEvent);
      return sendBadRequest(response)();
    }

    let responseCallback: ResponseCallback = null;
    for (const requestEventHandler of options.requestEventHandlers) {
      const params = { request, response };
      responseCallback = await requestEventHandler(requestEvent, params);
      if (responseCallback) break;
    }
    if (responseCallback) responseCallback();
    else sendNotFound(response)();
  };
