import { AdapterHandler } from "./adapter";

export const createPipe = (handlers: AdapterHandler[]): AdapterHandler => {
  handlers = handlers.filter(Boolean);

  return async (adapter) => {
    let result = Promise.resolve();

    for (const handler of handlers) {
      await result;
      if (adapter.response.isResponse) {
        break;
      }
      result = handler(adapter);
    }

    await result;
  };
};
