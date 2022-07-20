import { Config } from "./types";

export const remove = async (config: Config): Promise<void> => {
  config.links = Object.fromEntries(
    Object.entries(config.links)
      .map(([name, packages]) => [
        name,
        packages.filter((name) => name in config.packages),
      ])
      .filter(([, packages]) => packages.length)
  );
};

export const set = async (config: Config): Promise<void> => {
  config.links = Object.entries(config.packages).reduce<Config["links"]>(
    (memo, [name, meta]) => {
      meta.deps.forEach((depName) => {
        if (!(depName in memo)) memo[depName] = [];
        memo[depName].push(name);
      });
      return memo;
    },
    {}
  );
};
