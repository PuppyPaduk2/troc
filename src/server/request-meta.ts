import * as path from "path";
import * as url from "url";
import * as http from "http";

import {
  getIncomingMessageData,
  proxyRequest,
  RequestOptionsFormatter,
} from "../utils/request";

type Options = {
  url?: string;
};

export type ApiParams = {
  version: string;
  path: string;
  query: url.UrlWithParsedQuery["query"];
};

export type Pkg = {
  scope: string;
  name: string;
};

export class RequestMeta {
  private original: http.IncomingMessage;
  private options: Options = {};
  private _data: Buffer | null = null;

  constructor(request: http.IncomingMessage, options?: Options) {
    this.original = request;
    this.options = options ?? this.options;
  }

  public get url(): string {
    return decodeURIComponent(this.options.url ?? this.original.url ?? "");
  }

  public get urlPath(): path.ParsedPath {
    return path.parse(this.url);
  }

  public get headers() {
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

  public get apiParams(): ApiParams | null {
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

  public get pkg(): Pkg {
    let result = this.url.match(/^\/([\w-]*)\/([\w-]*)(\/|$)/) ?? [];

    if (result.length) {
      const scope = (result[2] !== "-" ? result[1] : "") || "";
      const name = (result[2] !== "-" ? result[2] : "") || result[1] || "";

      return { scope, name };
    }

    result = this.url.match(/^\/([\w-]*)/) ?? [];

    return { scope: "", name: result[1] ?? "" };
  }

  public get method(): string {
    return this.original.method ?? "";
  }

  public get isSuccess(): boolean {
    const status = this.original.statusCode ?? 0;
    return status >= 200 && status < 300;
  }

  public async data(): Promise<Buffer> {
    this._data = this._data ?? (await getIncomingMessageData(this.original));
    return this._data;
  }

  public async json<T>(def: T): Promise<T> {
    try {
      return JSON.parse((await this.data()).toString());
    } catch {
      return def;
    }
  }

  public async proxyRequest(
    targetUrl: string,
    formatter?: RequestOptionsFormatter
  ): Promise<{ req: http.ClientRequest; res?: RequestMeta }> {
    const request = proxyRequest(this.original, targetUrl)(formatter);
    const data = await this.data();
    const { req, res } = await request(data);
    const resMeta = res ? new RequestMeta(res) : undefined;
    return { req, res: resMeta };
  }

  static getHeader(value?: string | string[]): string {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }
}
