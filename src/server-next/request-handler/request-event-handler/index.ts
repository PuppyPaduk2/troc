import { RequestEventHandler, RequestEventHandlers } from "./types";

export const createRequestEventHandler =
  (handlers: RequestEventHandlers): RequestEventHandler =>
  async (event, params) => {
    const handler = handlers[event.key.value];
    if (!handler) return;

    return await handler(event, params);
  };
