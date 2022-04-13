import { IncomingMessage, ClientRequest } from "http";
import * as url from "url";
import * as path from "path";
import {
  getIncomingMessageData,
  proxyRequest,
  RequestOptionsFormatter,
} from "../request";

export type RequestMetaHeaders = {
  referer: string;
  npmSession: string;
  authorization: string;
  host: string;
};

export type RequestMetaApi = {
  version: string;
  path: string;
  query: url.UrlWithParsedQuery["query"];
};

export type RequestProxy = {
  url: string;
  names?: string[];
  scopes?: string[];
  commands?: string[];
  exclude?: {
    names?: string[];
    scopes?: string[];
    commands?: string[];
  };
};

export class RequestMeta {
  private _data: Promise<Buffer> | null = null;
  public original: IncomingMessage;
  public proxies: RequestProxy[] = [];

  constructor(
    request: IncomingMessage,
    options?: { proxies?: RequestProxy[] }
  ) {
    this.original = request;
    this.proxies = options?.proxies ?? this.proxies;
  }

  public async data(): Promise<Buffer> {
    if (!this._data) {
      this._data = getIncomingMessageData(this.original);
    }

    return await this._data;
  }

  public async json<T>(): Promise<T | null> {
    try {
      return JSON.parse((await this.data()).toString());
    } catch {
      return null;
    }
  }

  public async proxy(
    targetUrl: string,
    formatter?: RequestOptionsFormatter
  ): Promise<{
    req: ClientRequest;
    res?: IncomingMessage;
  }> {
    return await proxyRequest(this.original, targetUrl)(formatter)(
      await this.data()
    );
  }

  public get url(): string {
    return decodeURIComponent(this.original.url ?? "");
  }

  public get parsedUrl(): path.ParsedPath {
    return path.parse(this.url);
  }

  public get headers(): RequestMetaHeaders {
    const { headers } = this.original;

    return {
      referer: headers.referer ?? "",
      npmSession: RequestMeta.getHeader(headers["npm-session"]),
      authorization: headers.authorization ?? "",
      host: headers.host ?? "",
    };
  }

  public get command(): string {
    return this.headers.referer.split(" ")[0] ?? "";
  }

  public get api(): RequestMetaApi | null {
    const parsedUrl = url.parse(this.url, true);
    const result = parsedUrl.pathname?.match(/^\/api\/(v(\d*))(\/.*)/);

    if (!result) return null;

    const version = result[1];

    if (!version) return null;

    const path = result[3];

    if (!path) return null;

    return { version, path, query: parsedUrl.query };
  }

  public get token(): string {
    const auth = this.headers.authorization.split(" ");

    return auth[1] ?? auth[0] ?? "";
  }

  public get pkg(): { scope: string; name: string } {
    let result = this.url.match(/^\/([\w-]*)\/([\w-]*)(\/|$)/) ?? [];

    if (result.length) {
      const scope = (result[2] !== "-" ? result[1] : "") || "";
      const name = (result[2] !== "-" ? result[2] : "") || result[1] || "";

      return { scope, name };
    }

    result = this.url.match(/^\/([\w-]*)/) ?? [];

    return { scope: "", name: result[1] ?? "" };
  }

  public get proxyUrls(): string[] {
    const { scope, name } = this.pkg;
    const command = this.command;
    const filteredUrls: string[] = [];

    for (const config of this.proxies) {
      if (
        !config.exclude?.scopes?.includes(scope) &&
        !config.exclude?.names?.includes(name) &&
        !config.exclude?.commands?.includes(command)
      ) {
        const { scopes = [], names = [], commands = [] } = config;

        const isAnyScope = !scopes.length;
        const isScope = Boolean(scopes.includes(scope)) || isAnyScope;

        const isAnyName = !names.length;
        const isName = Boolean(names.includes(name)) || isAnyName;

        const isAnyCommand = !commands.length;
        const isCommand = Boolean(commands.includes(command)) || isAnyCommand;

        const isAll = isAnyName && isAnyScope && isAnyCommand;

        if ((isName && isScope && isCommand) || isAll) {
          filteredUrls.push(config.url);
        }
      }
    }

    return Array.from(new Set(filteredUrls));
  }

  static getHeader(value?: string | string[]): string {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }

  static isSuccess(status: number): boolean {
    return status >= 200 && status < 300;
  }
}
