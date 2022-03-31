import { IncomingMessage, ServerResponse } from "http";
import * as path from "path";

import {
  getIncomingMessageData,
  proxyRequest,
  RequestOptionsFormatter,
} from "../utils/request";
import { Config } from "./config";
import { Tokens } from "./tokens";

export class Meta {
  public req: IncomingMessage;
  public res: ServerResponse;
  public serverConfig: Config = new Config();
  public tokens: Tokens;

  constructor(params: {
    req: IncomingMessage;
    res: ServerResponse;
    serverConfig?: Config;
    tokens?: Tokens;
  }) {
    this.req = params.req;
    this.res = params.res;
    this.serverConfig = params.serverConfig ?? this.serverConfig;
    this.tokens = params.tokens ?? new Tokens({ config: this.serverConfig });
  }

  public get url() {
    return decodeURIComponent(this.req.url ?? "");
  }

  public get referer() {
    return this.req.headers.referer ?? "";
  }

  public get npmSession() {
    const npmSession = this.req.headers["npm-session"];

    if (Array.isArray(npmSession)) {
      return npmSession[0] ?? "";
    }

    return npmSession ?? "";
  }

  public get command() {
    return this.referer.split(" ")[0] ?? "";
  }

  public get host() {
    return this.req.headers.host ?? "";
  }

  public get authorization() {
    return this.req.headers.authorization ?? "";
  }

  public get auth() {
    return this.authorization;
  }

  public get tokenPrefix() {
    return this.auth.split(" ")[0] ?? "";
  }

  public get token() {
    return this.auth.split(" ")[1] ?? "";
  }

  public get parsedUrl() {
    return path.parse(this.url);
  }

  public get method() {
    return this.req.method ?? "";
  }

  public get storageDir() {
    return this.serverConfig.storageDir;
  }

  public get tarballDir() {
    return path.join(
      this.storageDir,
      this.serverConfig.registryFolder,
      this.parsedUrl.dir
    );
  }

  public get tarballFile() {
    return path.join(this.tarballDir, this.parsedUrl.base);
  }

  public get infoDir() {
    return path.join(
      this.storageDir,
      this.serverConfig.registryFolder,
      this.parsedUrl.dir,
      this.parsedUrl.base
    );
  }

  public get infoFile() {
    return path.join(this.infoDir, this.serverConfig.packageInfoName);
  }

  public get proxyScope() {
    const { scope } = this.serverConfig.proxyUrls;

    return scope[Meta.getPkgMeta(this.url).scope] ?? [];
  }

  public get proxyCommand() {
    const { command } = this.serverConfig.proxyUrls;

    return command[this.command] ?? [];
  }

  public get proxyUrls() {
    const { all } = this.serverConfig.proxyUrls;
    const urls = new Set([...this.proxyScope, ...this.proxyCommand, ...all]);

    return Array.from(urls);
  }

  public get data() {
    return getIncomingMessageData(this.req);
  }

  public get apiVersion() {
    return Meta.getApiMeta(this.url).version;
  }

  public get apiPath() {
    return Meta.getApiMeta(this.url).path;
  }

  public async proxy(
    formatter: (targetUrl: string) => RequestOptionsFormatter = () =>
      (options) =>
        options
  ) {
    const data = await this.data;

    for (const targetUrl of this.proxyUrls) {
      const request = proxyRequest(this.req, targetUrl)(formatter(targetUrl));
      const { res } = await request(data);

      if (res && Meta.isResSuccessful(this.res)) {
        return await getIncomingMessageData(res);
      }
    }

    return null;
  }

  static getApiMeta(url: string) {
    const result = url.match(/^api\/(v(\d*))\/(.*)/) ?? [];

    return { version: result[1] ?? "", path: result[3] ?? "" };
  }

  static getPkgMeta(url: string) {
    const result = url.match(/^\/(.*)\/(.*)/) ?? [];

    return { scope: result[1] ?? "", name: result[2] ?? "" };
  }

  static isResSuccessful(res: ServerResponse | IncomingMessage): boolean {
    return typeof res.statusCode === "number"
      ? res.statusCode >= 200 && res.statusCode < 300
      : false;
  }
}
