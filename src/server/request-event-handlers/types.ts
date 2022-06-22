import { IncomingMessage, ServerResponse } from "http";

import { Handler, Handlers } from "../../utils/request-event-handler";

export type RequestEventHandler = Handler<Payload, Result>;

export type RequestEventHandlers = Handlers<Payload, Result>;

type Payload = {
  request: IncomingMessage;
  response: ServerResponse;
};

type Result = () => void;
