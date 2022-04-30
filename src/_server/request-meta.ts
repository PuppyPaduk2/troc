import * as path from "path";
import * as url from "url";
import * as http from "http";
import * as https from "https";

import { removeProps } from "../utils/object";

export type ApiParams = {
  version: string;
  path: string;
  query: url.UrlWithParsedQuery["query"];
};

export type Pkg = {
  scope: string;
  name: string;
};

export type RequestOptionsFormatter = (
  options: http.RequestOptions,
  extra: {
    parsedTargetUrl: URL;
  }
) => http.RequestOptions;

export class RequestMeta {
  private original: http.IncomingMessage;
  private _data: Buffer | null = null;

  constructor(request: http.IncomingMessage) {
    this.original = request;
  }

  public get url(): string {
    return decodeURIComponent(this.original.url ?? "");
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
    let result = this.url.match(/^\/([\w\d-_]*)\/([\w\d-_]*)(\/|$)/) ?? [];

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

  public get repoPath(): string {
    const url = this.url;
    const expWithScope = /^(.*)(\/@[\w\d-_]*)(\/[\w\d-_]*)$/;
    const expWithoutScope = /^(.*)(\/[\w\d-_]*)$/;
    const matchedUrl = url.match(expWithScope) || url.match(expWithoutScope);

    return matchedUrl ? matchedUrl[1] ?? "" : "";
  }

  public async data(): Promise<Buffer> {
    this._data =
      this._data ?? (await RequestMeta.getIncomingMessageData(this.original));
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
    formatter: RequestOptionsFormatter = (options) => options
  ): Promise<{ req: http.ClientRequest; res?: RequestMeta }> {
    const { req, res } = await RequestMeta.proxyRequest({
      req: this.original,
      data: await this.data(),
      formatter: (options, extra) =>
        formatter(
          {
            ...options,
            headers: options.headers
              ? removeProps(options.headers, "host")
              : undefined,
            path: path.join(extra.parsedTargetUrl.pathname, this.url),
          },
          extra
        ),
      targetUrl,
    });
    const resMeta = res ? new RequestMeta(res) : undefined;
    return { req, res: resMeta };
  }

  static getHeader(value?: string | string[]): string {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }

  static proxyRequest(params: {
    req: http.IncomingMessage;
    targetUrl: string;
    formatter?: RequestOptionsFormatter;
    data?: Buffer;
  }) {
    const {
      req,
      targetUrl,
      formatter = (options) => options,
      data = Buffer.from([]),
    } = params;
    const parsedTargetUrl = new URL(targetUrl);
    const options = formatter(
      {
        protocol: parsedTargetUrl.protocol || undefined,
        hostname: parsedTargetUrl.hostname || undefined,
        port: parsedTargetUrl.port || undefined,
        method: req?.method ?? "GET",
        headers: req.headers || undefined,
        path: parsedTargetUrl.pathname || undefined,
      },
      { parsedTargetUrl }
    );
    const request = RequestMeta.getRequest(options.protocol ?? "http:");

    return new Promise<{
      req: http.ClientRequest;
      res?: http.IncomingMessage;
    }>((resolve) => {
      const reqProxy = request(options);

      if (data) {
        reqProxy.write(data, "utf8");
      }

      reqProxy.on("response", (resProxy) => {
        resolve({ req: reqProxy, res: resProxy });
      });
      reqProxy.on("error", () => {
        resolve({ req: reqProxy });
      });
      reqProxy.end();
    });
  }

  static getRequest(protocol: string) {
    if (protocol === "http:") {
      return http.request;
    } else if (protocol === "https:") {
      return https.request;
    }

    throw new Error("Incorrect request type");
  }

  static getIncomingMessageData(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve) => {
      const data: Buffer[] = [];

      req.on("data", (chunk: Buffer) => {
        data.push(chunk);
      });

      req.on("end", () => {
        resolve(Buffer.concat(data));
      });

      req.on("error", () => {
        resolve(Buffer.from([]));
      });
    });
  }
}
