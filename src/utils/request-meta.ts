import { IncomingMessage, ServerResponse } from "http";
import * as path from "path";
import * as url from "url";

import { DataStorage } from "./data-storage";
import { getIncomingMessageData } from "./request";
import { ServerConfig } from "./server-config";

export class RequestMeta {
  public req: IncomingMessage;
  public res: ServerResponse;
  public serverConfig: ServerConfig;
  public dataStorage: DataStorage;

  constructor(params: {
    req: IncomingMessage;
    res: ServerResponse;
    serverConfig?: ServerConfig;
    dataStorage?: DataStorage;
  }) {
    this.req = params.req;
    this.res = params.res;
    this.serverConfig = params.serverConfig ?? new ServerConfig();
    this.dataStorage = params.dataStorage ?? new DataStorage();
  }

  public get url() {
    return decodeURIComponent(this.req.url ?? "");
  }

  public get headers() {
    const { headers } = this.req;

    return {
      referer: headers.referer ?? "",
      npmSession: RequestMeta.getHeader(headers["npm-session"]),
      authorization: headers.authorization ?? "",
      host: headers.host ?? "",
    };
  }

  public get command() {
    return this.headers.referer.split(" ")[0] ?? "";
  }

  public get method() {
    return this.req.method ?? "";
  }

  public get parsedUrl() {
    return path.parse(this.url);
  }

  public get paths() {
    const tarballDir = path.join(
      this.serverConfig.registryDir,
      this.parsedUrl.dir,
      this.command === "publish" ? this.parsedUrl.base : "",
      this.command === "publish" ? "-" : ""
    );
    const infoDir = path.join(
      this.serverConfig.registryDir,
      this.parsedUrl.dir,
      this.parsedUrl.base
    );

    return {
      tarball: {
        dir: tarballDir,
        file: path.join(tarballDir, this.parsedUrl.base),
      },
      info: {
        dir: infoDir,
        file: path.join(infoDir, "info.json"),
      },
    };
  }

  public get data(): Promise<Buffer> {
    return RequestMeta.getData(this.req);
  }

  // TODO Deprecated (Need remove)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get dataJson(): any {
    return RequestMeta.getDataJson(this.req);
  }

  public get api() {
    return RequestMeta.getApi(this.url);
  }

  public get token() {
    const auth = this.headers.authorization.split(" ");

    return auth[1] ?? auth[0] ?? "";
  }

  public get tokenShort() {
    const token = this.token;

    if (!token) {
      return "";
    }

    return `${token.slice(0, 6)}...${token.slice(-8)}`;
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

  public json<T>(): Promise<T | null> {
    return RequestMeta.getDataJson(this.req);
  }

  static getHeader(value?: string | string[]): string {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    return value ?? "";
  }

  static getApi(requestUrl: string) {
    const parsedUrl = url.parse(requestUrl, true);
    const result = parsedUrl.pathname?.match(/^\/api\/(v(\d*))(\/.*)/) ?? [];
    const version = result[1] ?? "";
    const path = result[3] ?? "";

    return { version, path, query: parsedUrl.query };
  }

  static isResSuccessful(res: ServerResponse | IncomingMessage): boolean {
    return typeof res.statusCode === "number"
      ? res.statusCode >= 200 && res.statusCode < 300
      : false;
  }

  static getData(res: IncomingMessage): Promise<Buffer> {
    return getIncomingMessageData(res);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static parseData<T = any>(data: Buffer): T | null {
    try {
      return JSON.parse(data.toString());
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getDataJson<T = any>(res: IncomingMessage): Promise<T | null> {
    return RequestMeta.parseData<T>(await RequestMeta.getData(res));
  }
}
