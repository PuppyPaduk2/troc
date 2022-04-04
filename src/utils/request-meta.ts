import { IncomingMessage, ServerResponse } from "http";
import * as path from "path";
import * as url from "url";

import { InfraStorage } from "./infra-storage";
import { getIncomingMessageData } from "./request";
import { ServerConfig } from "./server-config";

export class RequestMeta {
  public req: IncomingMessage;
  public res: ServerResponse;
  public serverConfig: ServerConfig;
  public infraStorage: InfraStorage;

  constructor(params: {
    req: IncomingMessage;
    res: ServerResponse;
    serverConfig: ServerConfig;
    infraStorage: InfraStorage;
  }) {
    this.req = params.req;
    this.res = params.res;
    this.serverConfig = params.serverConfig;
    this.infraStorage = params.infraStorage;
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

  public get data() {
    return getIncomingMessageData(this.req);
  }

  public get dataJson() {
    return this.data
      .then((data) => JSON.parse(data.toString()))
      .catch(() => null);
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
}
