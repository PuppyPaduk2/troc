import { Adapter } from "./adapter";
import { createPipe } from "./pipe";

export const createPipeAdapter = <Payload = void>() => {
  const pipe = createPipe<Payload, Adapter>(
    async (_, adapter) => !adapter.res.closed
  );

  return pipe;
};

// const handler = createPipeAdapter()
//   .next(async (_, adapter) => {
//     return ["asd", "zxc"];
//   })
//   .next(async (p) => p.length)
//   .next(async (n) => n);

// const handler2 = createPipeAdapter<string[]>().next(
//   async (payload, adapter) => {
//     console.log(payload);
//     console.log(adapter.res.sendBadRequest());
//   }
// );

// handler.next(handler2);

// handler(
//   undefined,
//   new Adapter({
//     request: {} as any,
//     response: {} as any,
//     registries: {} as any,
//   })
// );
