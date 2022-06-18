import { Callback, time } from "./time";

export const logTimeMs = <Args extends Array<unknown>, Result>(
  key: string,
  callback: Callback<Args, Result>
): Callback<Args, Result> => {
  return time(key, callback, ({ key, period }) =>
    console.log(key, period + "ms")
  );
};
