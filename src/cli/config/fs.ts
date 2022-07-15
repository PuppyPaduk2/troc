import { resolve } from "path";

import { version } from "../../../package.json";
import { readJson, writeJson } from "../../utils/fs";
import { getPort } from "../../utils/net";
import { Config as RegistryConfig } from "../../utils/registry";

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
    ...(await readJson<Config>(file)),
  };
};

export const write = (file: string, config: Config) => {
  return writeJson(file, config, null, 2);
};

export type Config = {
  version: string;
  storageDir: string;
  port: number;
  localPathname: string;
  packages: Record<PackageName, PackageMeta>;
  npmrcs: Record<Hash, Base64>;
  registries: Record<RegistryKey, RegistryConfig>;
};

export type PackageName = string;
export type PackageMeta = {
  dir: string;
  version: string;
  npmrc: Hash;
  registry: Hash;
};

export type RegistryKey = string;
export type Hash = string;
export type Base64 = string;
