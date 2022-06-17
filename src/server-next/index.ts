import { installHandlers } from "./request-handler/request-event-handler/npm-command/install";
import { viewHandlers } from "./request-handler/request-event-handler/npm-command/view";
import { publishHandlers } from "./request-handler/request-event-handler/npm-command/publish";

export { createRequestHandler } from "./request-handler";
export { RequestEventHandler } from "./request-handler/request-event-handler/types";
export { createRequestEventHandler } from "./request-handler/request-event-handler";
export const requestEventHandlers = {
  install: installHandlers,
  view: viewHandlers,
  publish: publishHandlers,
};
