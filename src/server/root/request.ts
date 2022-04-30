import * as http from "http";
import * as url from "url";
import * as path from "path";

export type RequestParams = {
  req: http.IncomingMessage;
};

export class Request {
  private req: http.IncomingMessage;
  private body: Buffer | null = null;

  constructor(options: RequestParams) {
    this.req = options.req;
  }

  public get url(): url.UrlWithParsedQuery {
    return url.parse(decodeURIComponent(this.req.url ?? ""), true);
  }

  public get path(): path.ParsedPath {
    return path.parse(this.url.href);
  }

  private get npmApi(): RegExpMatchArray | null {
    return this.url.href.match(Request.extNpmApi);
  }

  private get npmPkgWithScope(): RegExpMatchArray | null {
    return this.url.href.match(Request.expWithScope);
  }

  private get npmPkgWithoutScope(): RegExpMatchArray | null {
    return this.url.href.match(Request.expWithoutScope);
  }

  private get api(): RegExpMatchArray | null {
    return this.url.href.match(Request.expApi);
  }

  public get registryUrl(): string {
    if (this.api) return this.api[1] ?? "";
    if (this.npmApi) return this.npmApi[1] ?? "";
    if (this.npmPkgWithScope) return this.npmPkgWithScope[1] ?? "";
    if (this.npmPkgWithoutScope) return this.npmPkgWithoutScope[1] ?? "";
    return "";
  }

  public get headers() {
    const { headers } = this.req;

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
    if (this.api) return this.api[2];
    return "";
  }

  public get apiPath(): string {
    if (this.api) return this.api[3];
    return "";
  }

  public get method(): string {
    return this.req.method ?? "";
  }

  public get npmCommand(): string {
    return this.headers.referer.split(" ")[0] ?? "";
  }

  public get pkgScope(): string {
    if (this.npmPkgWithScope) return this.npmPkgWithScope[3];
    return "";
  }

  public get pkgName(): string {
    if (this.npmPkgWithScope) return this.npmPkgWithScope[5];
    if (this.npmPkgWithoutScope) return this.npmPkgWithoutScope[3];
    return "";
  }

  public async data(): Promise<Buffer> {
    this.body = this.body ?? (await Request.getIncomingMessageData(this.req));
    return this.body;
  }

  public async json<T>(def: T): Promise<T> {
    try {
      return JSON.parse((await this.data()).toString());
    } catch {
      return def;
    }
  }

  static extNpmApi = /^(.*)(\/-.*)/;

  static expWithScope = /^(.*)(\/(@[\w\d-_]*))(\/([\w\d-_]*))$/;

  static expWithoutScope = /^(.*)(\/([\w\d-_]*))$/;

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
}
