import * as http from "http";

import { parseNpmCommand } from "../../utils/npm-command";
import { Registry } from "../../utils/registry";
import { RequestEvent } from "../../utils/request-event";
import {
  RequestEventHandler,
  ResponseCallback,
} from "../../utils/request-event-handler";
import { sendBadRequest, sendNotFound } from "../../utils/response";
import { parseUrl } from "../../utils/url";

type RequestHandlerOptions = {
  registries: Registry[];
  requestEventHandlers: RequestEventHandler[];
};

export const createRequestHandler =
  (options: RequestHandlerOptions) =>
  async (request: http.IncomingMessage, response: http.ServerResponse) => {
    const parsedUrl = parseUrl(request.url);
    const registry = RequestEvent.findRegistry(options.registries, parsedUrl);
    if (!registry) return sendBadRequest(response)();

    const requestEvent = new RequestEvent({
      npmCommand: parseNpmCommand(request.headers.referer),
      parsedUrl,
      registry,
    });
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
