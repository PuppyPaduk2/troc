import { IncomingMessage, ServerResponse } from "http";
import * as path from "path";

import { getIncomingMessageData } from "../utils/request";
import { Config } from "./config";

export class Meta {
  public req: IncomingMessage;
  public res: ServerResponse;
  public serverConfig: Config = new Config();

  constructor(params: {
    req: IncomingMessage;
    res: ServerResponse;
    serverConfig?: Config;
  }) {
    this.req = params.req;
    this.res = params.res;
    this.serverConfig = params.serverConfig ?? this.serverConfig;
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

  public get parsedUrl() {
    return path.parse(this.url);
  }

  public get method() {
    return this.req.method ?? "";
  }

  public get storageDir() {
    return this.serverConfig.storageDir;
  }

  public get tarballProxyDir() {
    return path.join(
      this.storageDir,
      this.serverConfig.proxyFolder,
      this.parsedUrl.dir
    );
  }

  public get tarballProxyFile() {
    return path.join(this.tarballProxyDir, this.parsedUrl.base);
  }

  public get infoProxyDir() {
    return path.join(
      this.storageDir,
      this.serverConfig.proxyFolder,
      this.parsedUrl.dir,
      this.parsedUrl.base
    );
  }

  public get infoProxyFile() {
    return path.join(this.infoProxyDir, this.serverConfig.packageInfoName);
  }

  public get tarballPackageDir() {
    if (this.command === "publish") {
      return path.join(
        this.storageDir,
        this.serverConfig.packagesFolder,
        this.url,
        "-"
      );
    }

    return path.join(
      this.storageDir,
      this.serverConfig.packagesFolder,
      this.parsedUrl.dir
    );
  }

  public get tarballPackageFile() {
    return path.join(this.tarballPackageDir, this.parsedUrl.base);
  }

  public get infoPackageDir() {
    return path.join(
      this.storageDir,
      this.serverConfig.packagesFolder,
      this.parsedUrl.dir,
      this.parsedUrl.base
    );
  }

  public get infoPackageFile() {
    return path.join(this.infoPackageDir, this.serverConfig.packageInfoName);
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

  // protected getTarballDir(folderName: string) {
  //   return path.join(this.storageDir, folderName, this.parsedUrl.dir);
  // }

  // protected getInfoDir(folderName: string) {
  //   return path.join(
  //     this.storageDir,
  //     folderName,
  //     this.parsedUrl.dir,
  //     this.parsedUrl.base
  //   );
  // }

  static getApiMeta(url: string) {
    const result = url.match(/^api\/(v(\d*))\/(.*)/) ?? [];

    return { version: result[1] ?? "", path: result[3] ?? "" };
  }

  static getPkgMeta(url: string) {
    const result = url.match(/^\/(.*)\/(.*)/) ?? [];

    return { scope: result[1] ?? "", name: result[2] ?? "" };
  }
}
