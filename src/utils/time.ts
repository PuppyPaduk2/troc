export type Callback<Args extends Array<unknown>, Result> = (
  ...args: Args
) => Promise<Result> | Result;

export type TimeCallback = (payload: TimePoint) => void;

export type TimePoint = {
  key: string;
  start: number;
  finish: number;
  period: number;
};

export const time = <Args extends Array<unknown>, Result>(
  key: string,
  callback: Callback<Args, Result>,
  timeCallback: TimeCallback
): Callback<Args, Result> => {
  return async (...args) => {
    const pending = callback(...args);
    const { result, timePoint } = await timePromise(key, pending);
    timeCallback(timePoint);
    return result;
  };
};

export const timePromise = async <Result>(
  key: string,
  pending: Promise<Result> | Result
): Promise<{ result: Result; timePoint: TimePoint }> => {
  const start = new Date().getTime();
  const result = await pending;
  const finish = new Date().getTime();
  const period = finish - start;
  const timePoint = { key, start, finish, period };
  return { result, timePoint };
};
