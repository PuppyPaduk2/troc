import { IncomingMessage } from "http";
import * as url from "url";
import * as path from "path";
import { getIncomingMessageData } from "../request";

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

export class RequestMeta {
  public original: IncomingMessage;

  constructor(request: IncomingMessage) {
    this.original = request;
  }

  public async data(): Promise<Buffer> {
    return await getIncomingMessageData(this.original);
  }

  public async json<T>(): Promise<T | null> {
    try {
      return JSON.parse((await this.data()).toString());
    } catch {
      return null;
    }
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

  static getHeader(value?: string | string[]): string {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }
}
