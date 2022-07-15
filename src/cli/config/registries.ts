import { join } from "path";

import { readFileSoft } from "../../utils/fs";
import { getNpmGlobalConfigPath, getNpmUserConfigPath } from "../../utils/npm";
import { Config as RegistryConfig } from "../../utils/registry";
import { Base64, Config, Hash, PackageMeta, PackageName } from "./fs";

export const remove = async (config: Config): Promise<void> => {
  const registryKeys = Object.values(config.packages).map(
    ({ registry }) => registry
  );

  config.registries = Object.fromEntries(
    Object.entries(config.registries).filter(([key]) =>
      registryKeys.includes(key)
    )
  );
};

export const set = async (config: Config): Promise<void> => {
  const localPackages = getLocalPackages(config);

  await Promise.all(
    Object.values(config.packages).map(async (meta) => {
      if (!meta.registry || !(meta.registry in config.registries)) {
        const hash = meta.npmrc;
        const registryKey = meta.registry || hash;
        if (hash in config.npmrcs) {
          config.registries[registryKey] = toRegistryConfig(
            config,
            hash,
            await getNpmrcEntries(hash, config.npmrcs[hash]),
            localPackages
          );
        }
      }
    })
  );

  if (!("local" in config.registries)) {
    config.registries["local"] = {
      path: config.localPathname,
      dir: join(config.storageDir, config.localPathname),
      proxies: [],
    };
  }

  getPackagesByNpmrc(config).forEach(([hash, packages]) => {
    Object.values(packages).forEach((meta) => {
      if (!meta.registry || !(meta.registry in config.registries)) {
        meta.registry = hash;
      }
    });
  });
};

const getPackagesByNpmrc = (config: Config) => {
  const byNpmrc = Object.entries(config.packages).reduce<PackagesByNpmrc>(
    (memo, [name, meta]) => {
      if (!memo[meta.npmrc]) memo[meta.npmrc] = {};
      memo[meta.npmrc][name] = meta;
      return memo;
    },
    {}
  );
  return Object.entries(byNpmrc);
};

type PackagesByNpmrc = Record<Hash, Record<PackageName, PackageMeta>>;

const getLocalPackages = (config: Config): string[] => {
  return Array.from(
    new Set(
      Object.keys(config.packages).map(
        (name) => "/(install|view|publish)/" + name
      )
    )
  );
};

// const parseNpmrcs = async (config: Config): Promise<[Hash, NpmrcEntry[]][]> => {
//   return await Promise.all(
//     Object.entries(config.npmrcs).map(([hash, base64]) =>
//       Promise.all([Promise.resolve(hash), getNpmrcEntries(base64)])
//     )
//   );
// };

const getNpmrcEntries = async (
  hash: Hash,
  base64: Base64
): Promise<NpmrcEntry[]> => {
  let entries = configs.byArg[hash];
  if (entries && entries.length) return entries;
  entries = parseNpmrc(base64);
  if (entries && entries.length) return entries;
  entries = await getUser();
  if (entries.length) return entries;
  entries = await getGlobal();
  if (entries.length) return entries;
  return [];
};

const getUser = async (): Promise<NpmrcEntry[]> => {
  if (configs.user) return configs.user;
  const path = await getNpmUserConfigPath();
  const data = (await readFileSoft(path)).toString("base64");
  const entries = parseNpmrc(data);
  if (!configs.user) configs.user = entries;
  return configs.user;
};

const getGlobal = async (): Promise<NpmrcEntry[]> => {
  if (configs.global) return configs.global;
  const path = await getNpmGlobalConfigPath();
  const data = (await readFileSoft(path)).toString();
  const entries = parseNpmrc(data);
  if (!configs.global) configs.global = entries;
  return configs.global;
};

const configs: {
  byArg: Record<Hash, NpmrcEntry[]>;
  user: NpmrcEntry[] | null;
  global: NpmrcEntry[] | null;
} = {
  byArg: {},
  user: null,
  global: null,
};

const parseNpmrc = (base64: Base64): NpmrcEntry[] => {
  return Buffer.from(base64, "base64")
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim())
    .filter((line) => !line.match(/^#/) && !line.match(/^\/\//))
    .map((line) => line.replace(/#.*/, "").trim())
    .map((line): NpmrcEntry => {
      const separator = "=";
      const [key, ...value] = line.split(separator);
      return [key.trim(), value.join(separator).trim()];
    })
    .filter(([key]) => Boolean(key.match(/registry/)));
};

const toRegistryConfig = (
  config: Config,
  hash: Hash,
  nprmcEntries: NpmrcEntry[],
  localPackages: string[]
): RegistryConfig => ({
  path: "/" + hash,
  dir: join(config.storageDir, hash),
  proxies: [
    ...nprmcEntries.map((entry) => ({
      url: entry[1],
      include: [entryToProxyInclude(entry)],
      exclude: localPackages,
    })),
    {
      url: "http://localhost:" + config.port + config.localPathname,
      include: localPackages,
    },
  ],
});

type NpmrcEntry = [string, string];

const entryToProxyInclude = ([key]: [string, string]): string => {
  const scope: string | null = (key.match(/^(@.*):/) ?? [])[1] ?? null;
  if (scope) return "/(install|view)/" + scope + "/(.*)";
  return "/(install|view)/(.*)";
};
