import { RequestEvent } from "./request-event";

export const createHandler =
  <Payload = unknown, Result = void>(
    handlers: Handlers<Payload, Result>
  ): Handler<Payload, Result> =>
  async (params) => {
    const handler = handlers[params.event.key.value];
    if (handler) return await handler(params);
  };

export type Handlers<Payload = unknown, Result = void> = Record<
  string,
  Handler<Payload, Result>
>;

export type Handler<Payload = unknown, Result = void> = (
  params: Params<Payload>
) => Promise<Result | void>;

export type Params<Payload = unknown> = {
  event: RequestEvent;
  payload: Payload;
};
