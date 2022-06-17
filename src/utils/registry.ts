import * as path from "path";
import { match, MatchFunction } from "path-to-regexp";

export type RegistryCommon<T> = {
  path: string;
  dir: string;
  proxies: RegistryProxy<T>[];
};

export type RegistryProxy<T> = {
  url: string;
  include?: T[];
  exclude?: T[];
};

export type RegistryConfig = RegistryCommon<string>;

export type Registry = RegistryCommon<MatchFunction>;

export const findRegistry = (
  registries: Registry[],
  registryPath: string
): Registry | null => {
  return registries.find(({ path }) => registryPath === path) ?? null;
};

export enum RegistryType {
  local = "local",
  proxy = "proxy",
  unknown = "unknown",
}

export const getRegistryType = (
  registry: RegistryConfig | Registry
): RegistryType => {
  return registry.proxies.length ? RegistryType.proxy : RegistryType.local;
};

export const getProxyUrl = (params: GetProxyUrlsParams): string | null => {
  const urls = getProxyUrls(params);
  return urls[0] ?? null;
};

type GetProxyUrlsParams = {
  registry: Registry;
  npmCommand?: string | null;
  pkgScope?: string | null;
  pkgName?: string | null;
};

export const getProxyUrls = (params: GetProxyUrlsParams): string[] => {
  const { registry } = params;
  const npmCommand = params.npmCommand ?? "";
  const pkgScope = params.pkgScope ?? "";
  const pkgName = params.pkgName ?? "";
  const filteredUrls: string[] = [];
  const key = "/" + path.join(npmCommand, pkgScope, pkgName);
  for (const config of registry.proxies) {
    const { include = [], exclude = [] } = config;
    const isInclude =
      include.map((match) => !!match(key)).find((value) => value) ?? false;
    const isExclude =
      exclude.map((match) => !!match(key)).find((value) => value) ?? false;
    if (isInclude && !isExclude) filteredUrls.push(config.url);
  }
  return Array.from(new Set(filteredUrls));
};

export const createRegistry = (config: RegistryConfig): Registry => {
  const proxies = config.proxies.map((config) => ({
    ...config,
    include: config.include?.map((item) => match(item)) ?? [],
    exclude: config.exclude?.map((item) => match(item)) ?? [],
  }));
  return { ...config, proxies };
};
