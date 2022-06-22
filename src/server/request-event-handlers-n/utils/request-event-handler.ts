import { RequestEventHandler } from "../types";

export const createHandler = (
  handlers: RequestEventHandler[]
): RequestEventHandler => {
  return async (params) => {
    for (const handler of handlers) {
      const result = await handler(params);
      if (result) return result;
    }
  };
};
