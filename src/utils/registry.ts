import * as path from "path";
import { match, MatchFunction } from "path-to-regexp";

export class Registry {
  path = "";
  dir = "";
  proxies: ProxyConfigMatch[] = [];

  constructor(config: Config) {
    this.path = config.path;
    this.dir = config.dir;
    this.proxies = config.proxies.map(Registry.toProxyConfigMatch);
  }

  get type(): RegistryType {
    return this.proxies.length ? RegistryType.proxy : RegistryType.local;
  }

  getProxyUrl(params: ProxyKeyParams): string | null {
    return this.getProxyUrls(params)[0] ?? null;
  }

  getProxyUrls(params: ProxyKeyParams): string[] {
    const proxyKey = Registry.buildProxyKey(params);
    const reduceFilters = Registry.reduceUrls.bind(null, proxyKey);
    const filteredUrls = this.proxies.reduce(reduceFilters, new Set());
    return Array.from(filteredUrls);
  }

  static toProxyConfigMatch(proxyConfig: ProxyConfig): ProxyConfigMatch {
    return {
      url: proxyConfig.url,
      include: proxyConfig.include?.map(Registry.toMatch) ?? [],
      exclude: proxyConfig.exclude?.map(Registry.toMatch) ?? [],
    };
  }

  static toMatch(value: string): MatchFunction {
    return match(value);
  }

  static buildProxyKey(params: ProxyKeyParams): string {
    const { npmCommand, pkgScope, pkgName } = params;
    const tail = path.join(npmCommand ?? "", pkgScope ?? "", pkgName ?? "");
    return "/" + tail;
  }

  static reduceUrls(
    proxyKey: string,
    memo: Set<string>,
    proxyMatch: ProxyConfigMatch
  ): Set<string> {
    const isMatch = Registry.isMatchProxyKey.bind(null, proxyKey);
    const isExclude = proxyMatch.exclude.map(isMatch).find(Boolean) ?? false;
    if (isExclude) return memo;

    const isInclude = proxyMatch.include.map(isMatch).find(Boolean) ?? false;
    if (isInclude) memo.add(proxyMatch.url);
    return memo;
  }

  static isMatchProxyKey(proxyKey: string, match: MatchFunction): boolean {
    return !!match(proxyKey);
  }

  static match(path: string, registry: Registry): boolean {
    return path === registry.path;
  }
}

type ProxyConfigMatch = {
  url: string;
  include: MatchFunction[];
  exclude: MatchFunction[];
};

export type Config = {
  path: string;
  dir: string;
  proxies: ProxyConfig[];
};

type ProxyConfig = {
  url: string;
  include?: string[];
  exclude?: string[];
};

type ProxyKeyParams = {
  npmCommand?: string | null;
  pkgScope?: string | null;
  pkgName?: string | null;
};

export enum RegistryType {
  local = "local",
  proxy = "proxy",
  unknown = "unknown",
}
