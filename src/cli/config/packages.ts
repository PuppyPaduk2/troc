import { glob as globGlob } from "glob";
import { dirname, join, resolve } from "path";

import { readPackageJson } from "../../utils/npm";
import { Config } from "./fs";

export const remove = async (config: Config): Promise<void> => {
  const dirs = await find(process.cwd());

  config.packages = Object.fromEntries(
    Object.entries(config.packages).filter(([, { dir }]) => !dirs.includes(dir))
  );
};

export const set = async (config: Config): Promise<void> => {
  const currentDirs = Object.values(config.packages).map(({ dir }) => dir);
  const dirs = (await find(process.cwd())).filter(
    (dir) => !currentDirs.includes(dir)
  );
  await Promise.all(
    dirs.map(async (dir) => {
      const path = join(dir, "package.json");
      const json = (await readPackageJson(path)) ?? { name: "", version: "" };
      config.packages[json.name] = {
        dir,
        version: json.version,
        npmrc: "",
        registry: "",
      };
    })
  );
};

const find = async (dir: string): Promise<string[]> => {
  const matches = await glob(dir);
  return matches.map((path) => dirname(resolve(dir, path)));
};

const glob = (cwd: string) => {
  return new Promise<string[]>((resolve, reject) => {
    globGlob(
      "**/package.json",
      { ignore: ["**/node_modules/**"], cwd },
      (error, matches) => {
        if (error) reject(error);
        else resolve(matches);
      }
    );
  });
};
