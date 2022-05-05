import * as http from "http";
import * as path from "path";

import { Request, RequestOptionsFormatter } from "./request";
import { Response } from "./response";
import {
  RegistryUrl,
  Registry,
  TokenData,
  SessionData,
  RegistryHooks,
  UserData,
} from "./registry";
import { removeProps, removePropsEmpty } from "../utils/object";
import { NpmPackageInfoFull } from "../utils/npm";

type AdapterParams = {
  request: Request;
  response: Response;
  registries: Map<RegistryUrl, Registry<Adapter>>;
};

export class Adapter {
  private _params: AdapterParams;
  private _registryHooks: RegistryHooks<Adapter> = {
    formatPackageInfo: async (info) => info,
  };

  constructor(params: AdapterParams) {
    this._params = params;
  }

  public get req(): Request {
    return this._params.request;
  }

  public get res(): Response {
    return this._params.response;
  }

  public get registry(): Registry<Adapter> | null {
    const { request, registries } = this._params;
    return registries.get(request.registryUrl) ?? null;
  }

  public get tokenData(): Promise<TokenData | null> {
    return this.registry?.getToken(this.req.token) ?? Promise.resolve(null);
  }

  public get isCorrectToken(): Promise<boolean> {
    return this.tokenData.then((data) => !!data) ?? Promise.reject(false);
  }

  public get proxyUrls(): string[] {
    if (!this.registry) return [];
    const { pkgScope, pkgName, npmCommand } = this._params.request;
    return this.registry.getProxyUrls({ pkgScope, pkgName, npmCommand });
  }

  public get closed(): boolean {
    return this.res.closed;
  }

  public get session(): Promise<SessionData | null> {
    return Promise.resolve(this.registry).then((registry) => {
      if (!registry) return null;
      return registry.getSession(this.req.token);
    });
  }

  public get hooks() {
    return {
      formatPackageInfo: (info: NpmPackageInfoFull) => {
        const handler =
          this.registry?.hooks.formatPackageInfo ??
          this._registryHooks.formatPackageInfo;
        return handler(info, this);
      },
    };
  }

  public get registryPackagesDir(): string {
    return this.registry?.packagesDir ?? "";
  }

  public get infoDir(): string {
    return path.join(
      this.registryPackagesDir,
      this.req.path.dir,
      this.req.path.base
    );
  }

  public get infoFile(): string {
    return path.join(this.infoDir, "info.json");
  }

  public get tarballDir(): string {
    const isPublish = this.req.npmCommand === "publish";
    return path.join(
      this.registryPackagesDir,
      this.req.path.dir,
      isPublish ? this.req.path.base : "",
      isPublish ? "-" : ""
    );
  }

  public get tarballFile(): string {
    return path.join(this.tarballDir, this.req.path.base);
  }

  public get userData(): Promise<UserData | null> {
    return this.tokenData.then((tokenData) => {
      if (!tokenData) return null;
      const registry = this.registry;
      if (!registry) return null;
      return registry.getUser(tokenData.username);
    });
  }

  public async getAuthorization(targetUrl: string): Promise<string> {
    const sessionData = await this.session;
    if (!sessionData) return "";
    const token = sessionData.registries[targetUrl] ?? "";
    if (!token) return "";
    return `Bearer ${token}`;
  }

  public async proxyRequest(
    targetUrl: string,
    formatter: RequestOptionsFormatter = (options) => options
  ): Promise<{ req: http.ClientRequest; res?: Request }> {
    const authorization = await this.getAuthorization(targetUrl);
    return await this.req.proxyRequest(targetUrl, (options, extra) => {
      const headers = {
        ...removeProps(options.headers ?? {}, "accept", "accept-encoding"),
        authorization,
      };
      // const m = (options.path ?? "").match(/^\/@(.*)/) ?? [];
      const nextOptions = removePropsEmpty({ ...options, headers });
      return formatter(nextOptions, extra);
    });
  }
}
