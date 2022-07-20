import { glob as globGlob, IOptions } from "glob";

export const glob = (
  pattern: string,
  options: IOptions = {}
): Promise<string[]> => {
  return new Promise((resolve, reject) =>
    globGlob(pattern, options, (error, matches) => {
      if (error) reject(error);
      else resolve(matches);
    })
  );
};
