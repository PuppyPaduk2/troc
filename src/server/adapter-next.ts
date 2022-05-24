import * as http from "http";

import {
  NpmCredentials,
  NpmPackageInfo,
  NpmPackageInfoFull,
  NpmPackageInfoPublish,
} from "../utils/npm";
import { SessionData, Token, TokenData, UserData } from "./registry-cache";
import { RegistryHooks, RegistryNext, RegistryUrl } from "./registry-next";
import { RequestNext, RequestOptionsFormatter } from "./request-next";
import { removeProps, removePropsEmpty } from "../utils/object";
import { Response } from "./response";
import { generateToken, hmac } from "../utils/crypto";
import { Logger } from "./logger";

type AdapterParams = {
  registries: Map<RegistryUrl, RegistryNext>;
  request: RequestNext;
  response: Response;
  logger: Logger;
};

export class AdapterNext {
  private _registries: Map<RegistryUrl, RegistryNext>;
  private _registryHooks: RegistryHooks = {
    formatPackageInfo: async (info) => info,
  };
  public request: RequestNext;
  public response: Response;
  public logger: Logger;

  constructor(params: AdapterParams) {
    this._registries = params.registries;
    this.request = params.request;
    this.response = params.response;
    this.logger = params.logger;
  }

  public get token(): string | null {
    return this.request.headers.token;
  }

  // Registry
  public get registry(): RegistryNext | null {
    const registryUrl = this.request.url.registry ?? "";
    return this._registries.get(registryUrl) ?? null;
  }

  public get proxyUrls(): string[] {
    const { pkgScope, pkgName } = this.request.url;
    const { npmCommand } = this.request.headers;
    if (!this.registry) return [];
    return this.registry.getProxyUrls({ pkgScope, pkgName, npmCommand });
  }

  public get proxyUrl(): string | null {
    const urls = this.proxyUrls;
    return urls.length ? urls[0] : null;
  }

  public async getTokenData(): Promise<TokenData | null> {
    if (!this.registry || !this.token) return null;
    return await this.registry.cache.getToken(this.token);
  }

  public async getSessionData(): Promise<SessionData | null> {
    if (!this.registry || !this.token) return null;
    return this.registry.cache.getSession(this.token);
  }

  public async getUserData(username?: string): Promise<UserData | null> {
    const name = (await this.getTokenData())?.username ?? username ?? "";
    return this.registry?.cache.getUser(name) ?? null;
  }

  public async getAuthorization(targetUrl: string): Promise<string> {
    const sessionData = await this.getSessionData();
    const token = sessionData?.registries[targetUrl];
    if (!sessionData || !token) return "";
    return `Bearer ${token}`;
  }

  public async createToken(tokenData: TokenData): Promise<Token> {
    const token = generateToken();
    await this.registry?.cache.setToken(token, tokenData);
    return token;
  }

  public get hooks() {
    return {
      formatPackageInfo: (info: NpmPackageInfoFull) => {
        const handler =
          this.registry?.hooks.formatPackageInfo ??
          this._registryHooks.formatPackageInfo;
        return handler(info, this.request);
      },
    };
  }

  public get pkgInfoFile(): string | null {
    const { pkgScope, pkgName } = this.request.url;
    if (!pkgName) return null;

    return this.registry?.getPkgInfoFile({ pkgScope, pkgName }) ?? null;
  }

  public get pkgTarballFile(): string | null {
    const { pkgScope, pkgName, tarballVersion } = this.request.url;
    if (!pkgName || !tarballVersion) return null;

    return (
      this.registry?.getPkgTarballFile({ pkgScope, pkgName, tarballVersion }) ??
      null
    );
  }

  public async isCorrectToken(): Promise<boolean> {
    if (!this.registry || !this.token) return false;
    return await this.registry.cache.isCorrectToken(this.token);
  }

  // public async proxyRequest(
  //   targetUrl: string,
  //   formatter: RequestOptionsFormatter = (options) => options
  // ): Promise<{ req: http.ClientRequest; res?: RequestNext }> {
  //   const authorization = await this.getAuthorization(targetUrl);
  //   return await this.request.proxy(targetUrl, (options, extra) => {
  //     const headers = {
  //       ...removeProps(options.headers ?? {}, "accept", "accept-encoding"),
  //       authorization,
  //     };
  //     const nextOptions = removePropsEmpty({ ...options, headers });
  //     return formatter(nextOptions, extra);
  //   });
  // }

  public async proxy(params?: {
    data?: Buffer;
    formatter?: RequestOptionsFormatter;
  }): Promise<{ req: http.ClientRequest; res?: RequestNext } | null> {
    if (!this.proxyUrl) return null;

    const authorization = await this.getAuthorization(this.proxyUrl);
    const _formatter: RequestOptionsFormatter =
      params?.formatter ?? ((options) => options);
    const formatter: RequestOptionsFormatter = (options) => {
      const headerKeys = ["accept", "accept-encoding"];
      const headers = removeProps(options.headers ?? {}, ...headerKeys);
      Object.assign(headers, { authorization });
      const nextOptions = removePropsEmpty({ ...options, headers });
      return _formatter(nextOptions);
    };

    return await this.request.proxy({
      targetUrl: this.proxyUrl,
      data: params?.data,
      formatter,
    });

    // for (const targetUrl of this.proxyUrls) {
    //   const { req, res } = await this.proxyRequest(targetUrl, formatter);
    //   if (res?.isSuccess) return { req, res };
    // }

    // return null;
  }

  public async readPkgInfo(): Promise<NpmPackageInfo> {
    if (!this.registry) return AdapterNext.defPkgInfo;

    const { pkgScope, pkgName } = this.request.url;
    if (!pkgName) return AdapterNext.defPkgInfo;

    return await this.registry.readPkgInfoJson({ pkgScope, pkgName });
  }

  public async writePkgInfo(pkgInfo: NpmPackageInfo): Promise<void> {
    if (!this.registry) return;

    const { pkgScope, pkgName } = this.request.url;
    if (!pkgName) return;

    return await this.registry.writePkgInfo({ pkgScope, pkgName, pkgInfo });
  }

  public async mergePkgInfo(
    pkgInfo: NpmPackageInfoFull
  ): Promise<NpmPackageInfo> {
    if (!this.registry) return AdapterNext.defPkgInfo;

    const { pkgScope, pkgName } = this.request.url;
    if (!pkgName) return AdapterNext.defPkgInfo;

    return await this.registry.mergePkgInfo({ pkgScope, pkgName, pkgInfo });
  }

  // public async readPkgInfo(): Promise<NpmPackageInfo> {
  //   return (await readJson<NpmPackageInfo>(this.infoFile)) ?? { versions: {} };
  // }

  // Request
  public async getDataAdduser(): Promise<NpmCredentials | null> {
    const requestData = this.request.data;
    const data = await requestData.json<Partial<NpmCredentials> | null>(null);
    if (!data || !data.name || !data.password || !data.email) return null;
    return { name: "", password: "", email: "", ...data };
  }

  public async isCorrectPassword(
    password: string,
    username?: string
  ): Promise<boolean> {
    const userData = await this.getUserData(username);
    return !!(userData && userData.password === hmac(password));
  }

  public async getPkgInfo(): Promise<NpmPackageInfoPublish | null> {
    return await this.request.data.json<NpmPackageInfoPublish | null>(null);
  }

  static defPkgInfo: NpmPackageInfo = {
    name: "",
    versions: {},
  };
}
