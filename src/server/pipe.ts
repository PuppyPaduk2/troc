export type Pipe<Payload, Result, Meta> = {
  (payload: Payload, meta: Meta): Promise<Result>;
  next<NR>(cb: Callback<Result, NR, Meta>): Pipe<Payload, NR, Meta>;
  guard(cb: Guard<Result, Meta>): Pipe<Payload, Result, Meta>;
};

type Callback<Payload, Result, Meta> = (
  payload: Payload,
  meta: Meta
) => Promise<Result>;

type Guard<Payload, Meta> = (payload: Payload, meta: Meta) => Promise<boolean>;

type Point<Payload, Result, Meta> =
  | {
      type: "handler";
      callback: Callback<Payload, Result, Meta>;
    }
  | {
      type: "guard";
      callback: Guard<Payload, Meta>;
    };

export function createPipe<Payload, Meta = void>(
  guardAll?: Guard<Payload, Meta>
): Pipe<Payload, Payload, Meta>;

export function createPipe<Payload, Result, Meta>(
  guardAll: Guard<Payload, Meta> = () => Promise.resolve(true)
): Pipe<Payload, Result, Meta> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: Set<Point<any, any, Meta>> = new Set();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipe: Pipe<Payload, any, Meta> = async (payload, meta) => {
    let result = Promise.resolve(payload);

    for (const { type, callback } of queue) {
      const resultNext = await result;
      if (!(await guardAll(payload, meta))) break;
      if (type === "guard" && !(await callback(resultNext, meta))) break;
      else result = callback(resultNext, meta);
    }

    return await result;
  };
  pipe.next = (callback) => {
    queue.add({ type: "handler", callback });
    return pipe;
  };
  pipe.guard = (callback) => {
    queue.add({ type: "guard", callback });
    return pipe;
  };
  return pipe;
}

// const pipe = createPipe<Date, void>()
//   .guard(async (payload) => true)
//   .next(async (payload) => {
//     return ["1"];
//   })
//   .guard(async (payload) => true)
//   .next(async (payload) => {
//     return payload.length;
//   })
//   .guard(async (payload) => true);

// pipe(new Date());

// const pipe = createPipe<void, Date, { name: string; age: number }>(
//   async (_, meta) => {
//     console.log(meta.name, meta.age);
//     return new Date();
//   }
// );

// pipe(undefined, { name: "bob", age: 10 }).then((r) => {
//   console.log(r.getTime());
// });

// createPipe<void, string[]>(async (payload) => {
//   console.log(payload);
//   return [];
// })
//   .next(async (payload) => {
//     console.log(payload);
//     return new Date();
//   })
//   .next(async (payload, close) => {
//     console.log(payload);
//     close();
//     return "zxc";
//   })
//   .next(async (payload) => {
//     console.log(payload);
//     return 0;
//   })()
//   .then((result) => {
//     console.log(result);
//   });

// const pipe = createPipe<void, number[]>(async (payload) => {
//   console.log(payload);
//   return [123];
// });
// const next = pipe
//   .next(async (payload) => {
//     console.log(payload);
//     return new Date();
//   })
//   .next(async () => {
//     return "qwe";
//   });
