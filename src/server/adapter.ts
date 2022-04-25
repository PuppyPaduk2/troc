import * as path from "path";
import {
  NpmPackageInfo,
  NpmPackageInfoPublish,
  NpmPackageInfoView,
} from "../utils/npm";

import { ProxyMeta } from "./proxy-meta";
import {
  ApiParams,
  RequestMeta,
  RequestOptionsFormatter,
} from "./request-meta";
import { ResponseMeta } from "./response-meta";
import { StorageMeta } from "./storage-meta";

export type AdapterHandler<Result = void> = (
  adapter: Adapter
) => Promise<Result>;

export type CommandHandlers = Record<string, AdapterHandler>;

export type ApiHandlers = Record<string, Record<string, AdapterHandler>>;

export type AdapterHooks = {
  formatterPackageInfo: (
    info: NpmPackageInfo | NpmPackageInfoView | NpmPackageInfoPublish,
    adapter: Adapter
  ) => Promise<NpmPackageInfo>;
};

type AdapterParams = {
  request: RequestMeta;
  response: ResponseMeta;
  storage: StorageMeta;
  proxy: ProxyMeta;
  hooks: AdapterHooks;
};

export class Adapter {
  public request: RequestMeta;
  public response: ResponseMeta;
  public storage: StorageMeta;
  public proxy: ProxyMeta;
  public hooks: AdapterHooks;

  constructor(params: AdapterParams) {
    this.request = params.request;
    this.response = params.response;
    this.storage = params.storage;
    this.proxy = params.proxy;
    this.hooks = params.hooks;
  }

  public get tarballDir(): string {
    const { urlPath, command } = this.request;

    return path.join(
      this.storage.registryDir,
      urlPath.dir,
      command === "publish" ? urlPath.base : "",
      command === "publish" ? "-" : ""
    );
  }

  public get tarballFile(): string {
    return path.join(this.tarballDir, this.request.urlPath.base);
  }

  public get infoDir(): string {
    return path.join(
      this.storage.registryDir,
      this.request.urlPath.dir,
      this.request.urlPath.base
    );
  }

  public get infoFile(): string {
    return path.join(this.infoDir, "info.json");
  }

  public get proxyUrls(): string[] {
    const { pkg, command } = this.request;
    return this.proxy.getUrls({ pkg, command });
  }

  public get authorization(): string {
    return this.getAuthorization(this.request.token);
  }

  public get url(): string {
    const url = this.request.url;
    const registryPaths = this.storage.registryPaths;
    const regExp = new RegExp(`^(${registryPaths.join("|")})`);

    return url.replace(regExp, "");
  }

  public get urlPath(): path.ParsedPath {
    return path.parse(this.url);
  }

  public getAuthorization(token?: string): string {
    if (!token) return "";
    return `Bearer ${token}`;
  }

  public async getSessionAuthorization(targetUrl: string): Promise<string> {
    const { sessions } = this.storage.data;
    const session = await sessions.get(this.request.token);
    const sessionToken = session?.registries[targetUrl];
    return this.getAuthorization(sessionToken);
  }

  public async proxyRequest(
    targetUrl: string,
    formatter: RequestOptionsFormatter = (options) => options
  ) {
    return this.request.proxyRequest(targetUrl, (options, extra) =>
      formatter(
        {
          ...options,
          path: path.join(extra.parsedTargetUrl.pathname, this.url),
        },
        extra
      )
    );
  }

  static getCommandHandler(
    command: string,
    handlers: CommandHandlers
  ): AdapterHandler | null {
    if (command && handlers[command]) return handlers[command];
    return null;
  }

  static getApiHandler(
    apiParams: ApiParams | null,
    apiHandlers: ApiHandlers
  ): AdapterHandler | null {
    if (!apiParams) return null;

    const versionHandlers = apiHandlers[apiParams.version];

    return versionHandlers[apiParams.path] ?? null;
  }

  static getHooks(): AdapterHooks {
    return {
      formatterPackageInfo: (info) => Promise.resolve(info),
    };
  }
}
