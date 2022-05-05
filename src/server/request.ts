import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as path from "path";
import { removeProps } from "../utils/object";

export type RequestOptionsFormatter = (
  options: http.RequestOptions,
  extra: {
    parsedTargetUrl: URL;
  }
) => http.RequestOptions;

export class Request {
  private _req: http.IncomingMessage;
  private _body: Buffer | null = null;

  constructor(req: http.IncomingMessage) {
    this._req = req;
  }

  public get url(): url.UrlWithParsedQuery {
    return url.parse(decodeURIComponent(this._req.url ?? ""), true);
  }

  public get path(): path.ParsedPath {
    return path.parse(this.url.href);
  }

  private get _npmApi(): RegExpMatchArray | null {
    return this.url.href.match(Request.extNpmApi);
  }

  private get _npmPkgWithScope(): RegExpMatchArray | null {
    return this.url.href.match(Request.expNpmPkgWithScope);
  }

  private get _npmPkgWithoutScope(): RegExpMatchArray | null {
    return this.url.href.match(Request.expNpmPkgWithoutScope);
  }

  private get _npmTarballWithScope(): RegExpMatchArray | null {
    return this.url.href.match(Request.extNpmTarballWithScope);
  }

  private get _npmTarballWithoutScope(): RegExpMatchArray | null {
    return this.url.href.match(Request.extNpmTarballWithoutScope);
  }

  private get _api(): RegExpMatchArray | null {
    return this.url.href.match(Request.expApi);
  }

  public get registryUrl(): string {
    if (this._npmTarballWithScope) return this._npmTarballWithScope[1] ?? "";
    if (this._npmTarballWithoutScope)
      return this._npmTarballWithoutScope[1] ?? "";
    if (this._api) return this._api[1] ?? "";
    if (this._npmApi) return this._npmApi[1] ?? "";
    if (this._npmPkgWithScope) return this._npmPkgWithScope[1] ?? "";
    if (this._npmPkgWithoutScope) return this._npmPkgWithoutScope[1] ?? "";
    return "";
  }

  public get headers() {
    const { headers } = this._req;

    return {
      referer: headers.referer ?? "",
      npmSession: Request.getHeader(headers["npm-session"]),
      authorization: headers.authorization ?? "",
      host: headers.host ?? "",
    };
  }

  public get token(): string {
    const auth = this.headers.authorization.split(" ");

    return auth[1] ?? auth[0] ?? "";
  }

  public get apiVersion(): string {
    if (this._api) return this._api[2];
    return "";
  }

  public get apiPath(): string {
    if (this._api) return this._api[3];
    return "";
  }

  public get method(): string {
    return this._req.method ?? "";
  }

  public get npmCommand(): string {
    return this.headers.referer.split(" ")[0] ?? "";
  }

  public get pkgScope(): string {
    if (this._npmPkgWithScope) return this._npmPkgWithScope[3];
    return "";
  }

  public get pkgName(): string {
    if (this._npmPkgWithScope) return this._npmPkgWithScope[5];
    if (this._npmPkgWithoutScope) return this._npmPkgWithoutScope[3];
    return "";
  }

  public get isSuccess(): boolean {
    const status = this._req.statusCode ?? 0;
    return status >= 200 && status < 300;
  }

  public async data(): Promise<Buffer> {
    this._body =
      this._body ?? (await Request.getIncomingMessageData(this._req));
    return this._body;
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
  ): Promise<{ req: http.ClientRequest; res?: Request }> {
    const { req, res } = await Request.proxyRequest({
      req: this._req,
      data: await this.data(),
      formatter: (options, extra) =>
        formatter(
          {
            ...options,
            headers: options.headers
              ? removeProps(options.headers, "host")
              : undefined,
            path: path.join(
              extra.parsedTargetUrl.pathname,
              this._req.url ?? ""
            ),
          },
          extra
        ),
      targetUrl,
    });
    const resMeta = res ? new Request(res) : undefined;
    return { req, res: resMeta };
  }

  static extNpmApi = /^(.*)(\/-.*)/;
  static expNpmPkgWithScope = /^(.*)(\/(@[\w\d-_]*))(\/([\w\d-_]*))$/;
  static expNpmPkgWithoutScope = /^(.*)(\/([\w\d-_]*))$/;
  static extNpmTarballWithScope =
    /^(.*)(\/(@[\w\d-_]*))(\/[\w\d-_]*\/-)(\/.*\.tgz)$/;
  static extNpmTarballWithoutScope = /^(.*)(\/[\w\d-_]*\/-)(\/.*\.tgz)$/;
  static expApi = /^\/api(\/.*)?(\/v\d*)(\/.+)/;

  static getHeader(value?: string | string[]): string {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
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
    const request = Request.getRequest(options.protocol ?? "http:");

    return new Promise<{
      req: http.ClientRequest;
      res?: http.IncomingMessage;
    }>((resolve) => {
      const reqProxy = request(options);

      console.log("XXX", options);

      if (data) {
        reqProxy.write(data, "utf8");
      }

      reqProxy.on("response", (resProxy) => {
        resolve({ req: reqProxy, res: resProxy });
      });
      reqProxy.on("error", () => {
        resolve({ req: reqProxy });
      });
      reqProxy.on("connect", () => {
        console.log("connect");
      });
      reqProxy.on("socket", () => {
        console.log("socket");
      });
      reqProxy.on("pipe", () => {
        console.log("pipe");
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
}
