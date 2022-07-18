import { resolve } from "path";

import { version } from "../../../package.json";
import { readJson, writeJson } from "../../utils/fs";
import { getPort } from "../../utils/net";
import { Config } from "./types";

export const getDefault = async (): Promise<Config> => ({
  version: version,
  storageDir: resolve(__dirname, "./storage"),
  port: await getPort(4000),
  localPathname: "/local",
  packages: {},
  npmrcs: {},
  registries: {},
});

export const read = async (file: string): Promise<Config> => {
  return {
    ...(await getDefault()),
    ...(await readJson<Config>(getPath(file))),
  };
};

export const getPath = (path: string): string => {
  return resolve(process.cwd(), path);
};

export const write = (file: string, config: Config) => {
  return writeJson(file, config, null, 2);
};
