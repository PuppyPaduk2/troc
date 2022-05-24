import * as path from "path";
import { match, MatchFunction } from "path-to-regexp";
import * as fs from "fs/promises";
import * as merge from "merge";

import { accessSoft, readFileSoft, readJson } from "../utils/fs";
import { NpmPackageInfo, NpmPackageInfoFull } from "../utils/npm";
import { RegistryCache } from "./registry-cache";
import { RequestNext } from "./request-next";
import { removeProps } from "../utils/object";

export type RegistryUrl = string;

export type RegistryDir = string;

export type ProxyConfig<T> = {
  url: string;
  include?: T[];
  exclude?: T[];
};

export type RegistryParams = {
  dir: RegistryDir;
  proxyConfigs: ProxyConfig<string>[];
  hooks: Partial<RegistryHooks>;
};

export type RegistryHooks = {
  formatPackageInfo: (
    info: NpmPackageInfoFull,
    request: RequestNext
  ) => Promise<NpmPackageInfo>;
};

export class RegistryNext {
  private _dir: RegistryDir;
  private _proxyConfigs: ProxyConfig<MatchFunction>[];
  public cache: RegistryCache;
  public hooks: RegistryHooks = {
    formatPackageInfo: async (info) => info,
  };

  constructor(params: RegistryParams) {
    this._dir = params.dir;
    this._proxyConfigs = params.proxyConfigs.map((config) => ({
      ...config,
      include: config.include?.map((item) => match(item)) ?? [],
      exclude: config.exclude?.map((item) => match(item)) ?? [],
    }));
    this.cache = new RegistryCache(this._dir);
    this.hooks = { ...this.hooks, ...params.hooks };
  }

  public get packagesDir(): string {
    return path.join(this._dir, "packages");
  }

  public get isProxy(): boolean {
    return Boolean(this._proxyConfigs.length);
  }

  public getProxyUrls(params: {
    npmCommand?: string | null;
    pkgScope?: string | null;
    pkgName?: string | null;
  }): string[] {
    const npmCommand = params.npmCommand ?? "";
    const pkgScope = params.pkgScope ?? "";
    const pkgName = params.pkgName ?? "";
    const filteredUrls: string[] = [];
    const key = "/" + path.join(npmCommand, pkgScope, pkgName);
    for (const config of this._proxyConfigs) {
      const { include = [], exclude = [] } = config;
      const isInclude =
        include.map((match) => !!match(key)).find((value) => value) ?? false;
      const isExclude =
        exclude.map((match) => !!match(key)).find((value) => value) ?? false;
      if (isInclude && !isExclude) filteredUrls.push(config.url);
    }
    return Array.from(new Set(filteredUrls));
  }

  public getProxyUrl(params: {
    npmCommand?: string | null;
    pkgScope?: string | null;
    pkgName?: string | null;
  }): string | null {
    const urls = this.getProxyUrls(params);
    return urls.length ? urls[0] : null;
  }

  public getPkgFolder(params: {
    pkgScope?: string | null;
    pkgName: string;
  }): string {
    return path.join(params.pkgScope ?? "", params.pkgName);
  }

  public getPkgInfoFile(params: {
    pkgScope?: string | null;
    pkgName: string;
  }): string {
    return path.join(this.packagesDir, this.getPkgFolder(params), "info.json");
  }

  public getPkgTarballPathname(params: {
    pkgScope?: string | null;
    pkgName: string;
    tarballVersion: string;
  }): string {
    const pkgFolder = this.getPkgFolder(params);
    const folder = path.join(pkgFolder, "-" /*, params.pkgScope ?? ""*/);
    const name = params.pkgName + "-" + params.tarballVersion + ".tgz";
    return path.join(folder, name);
  }

  public getPkgTarballFile(params: {
    pkgScope?: string | null;
    pkgName: string;
    tarballVersion: string;
  }): string {
    return path.join(this.packagesDir, this.getPkgTarballPathname(params));
  }

  public async readPkgInfo(params: {
    pkgScope?: string | null;
    pkgName: string;
  }): Promise<Buffer> {
    const file = this.getPkgInfoFile(params);
    return await readFileSoft(file);
  }

  public async readPkgInfoJson(params: {
    pkgScope?: string | null;
    pkgName: string;
  }): Promise<NpmPackageInfo> {
    const file = this.getPkgInfoFile(params);
    return (await readJson(file)) ?? { name: "", versions: {} };
  }

  public async writePkgInfo(params: {
    pkgScope?: string | null;
    pkgName: string;
    pkgInfo: NpmPackageInfo;
  }): Promise<void> {
    const file = this.getPkgInfoFile(params);
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(params.pkgInfo, null, 2));
  }

  public async accessPkgInfo(params: {
    pkgScope?: string | null;
    pkgName: string;
  }): Promise<boolean> {
    const file = this.getPkgInfoFile(params);
    return await accessSoft(file);
  }

  public async mergePkgInfo(params: {
    pkgScope?: string | null;
    pkgName: string;
    pkgInfo: NpmPackageInfoFull;
  }): Promise<NpmPackageInfo> {
    const clonedPkgInfo = JSON.parse(JSON.stringify(params.pkgInfo));
    const pkgInfo = removeProps(clonedPkgInfo, "_attachments");
    const currPkgInfo = await this.readPkgInfoJson(params);
    return merge.recursive(currPkgInfo, pkgInfo);
  }

  public async readPkgTarball(params: {
    pkgScope?: string | null;
    pkgName: string;
    tarballVersion: string;
  }): Promise<Buffer> {
    const file = this.getPkgTarballFile(params);
    return await readFileSoft(file);
  }

  public async writePkgTarball(params: {
    pkgScope?: string | null;
    pkgName: string;
    tarballVersion: string;
    data: Buffer | string;
  }): Promise<void> {
    const file = this.getPkgTarballFile(params);
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, params.data, "base64");
  }

  public async accessPkgTarball(params: {
    pkgScope?: string | null;
    pkgName: string;
    tarballVersion: string;
  }): Promise<boolean> {
    const file = this.getPkgTarballFile(params);
    return await accessSoft(file);
  }
}
