import * as http from "http";

import { RequestEvent } from "../request-event";

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
