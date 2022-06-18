import * as http from "http";

import { RequestEvent } from "./request-event";

export const createRequestEventHandler =
  (handlers: RequestEventHandlers): RequestEventHandler =>
  async (event, params) => {
    const handler = handlers[event.key.value];
    if (!handler) return;

    return await handler(event, params);
  };

export type ResponseCallback = (() => Promise<void> | void) | null | void;

export type RequestEventHandler<
  Result = ResponseCallback,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Params extends object = {}
> = (
  requestEvent: RequestEvent,
  params: RequestEventHandlerParams & Params
) => Promise<Result>;

type RequestEventHandlerParams = {
  response: http.ServerResponse;
  request: http.IncomingMessage;
};

export type RequestEventHandlers<Result = ResponseCallback> = Record<
  string,
  RequestEventHandler<Result>
>;
