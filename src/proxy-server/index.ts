import { Server, createServer } from "http";
import * as path from "path";
import { RegistryServer } from "../registry-server";

import { TrocRequestHandler, TrocServerData } from "../types";
import { generateToken, hmac } from "../utils/crypto";
import { NpmCredentials } from "../utils/npm";
import { removeProps } from "../utils/object";
import { changeHostPackageInfo, PackageInfo } from "../utils/package";
import { JsonCache } from "../utils/v2/json-cache";
import {
  NpmServer,
  ServerApiHandlers,
  ServerCommandHandlers,
} from "../utils/v2/npm-server";
import { RequestMeta, RequestProxy } from "../utils/v2/request-meta";
import { ServerConfig } from "../utils/v2/server-config";

export class ProxyServer {
  public server: Server;
  public npmServer: NpmServer<TrocServerData>;

  constructor(options?: {
    server?: Server;
    config?: ServerConfig;
    data?: TrocServerData;
    commandHandlers?: Partial<ServerCommandHandlers<TrocServerData>>;
    apiHandlers?: ServerApiHandlers<TrocServerData>;
    proxies?: RequestProxy[];
  }) {
    const config = options?.config ?? new ServerConfig();

    this.server = options?.server ?? createServer();
    this.npmServer = new NpmServer<TrocServerData>(
      this.server,
      options?.data ?? {
        users: new JsonCache(path.join(config.storageDir, "users.json")),
        tokens: new JsonCache(path.join(config.storageDir, "tokens.json")),
        sessions: new JsonCache(path.join(config.storageDir, "sessions.json")),
      },
      {
        config,
        commandHandlers: options?.commandHandlers
          ? {
              install: ProxyServer.dongle,
              publish: ProxyServer.dongle,
              view: ProxyServer.dongle,
              adduser: ProxyServer.dongle,
              logout: ProxyServer.dongle,
              whoami: ProxyServer.dongle,
              ...options.commandHandlers,
            }
          : {
              install: NpmServer.createHandlerPipe([
                ProxyServer.log,
                ProxyServer.checkToken,
                ProxyServer.handleCommandInstall,
              ]),
              view: NpmServer.createHandlerPipe([
                ProxyServer.log,
                ProxyServer.checkToken,
                ProxyServer.handleCommandView,
              ]),
              adduser: NpmServer.createHandlerPipe([
                ProxyServer.log,
                ProxyServer.checkCredentials,
                ProxyServer.handleCommandAdduser,
              ]),
              logout: NpmServer.createHandlerPipe([
                ProxyServer.log,
                ProxyServer.handleCommandLogout,
              ]),
              whoami: NpmServer.createHandlerPipe([
                ProxyServer.log,
                ProxyServer.checkToken,
                ProxyServer.handleCommandWhoami,
              ]),
              publish: NpmServer.createHandlerPipe([
                ProxyServer.log,
                ProxyServer.checkToken,
                ProxyServer.handleCommandPublish,
              ]),
            },
        apiHandlers: options?.apiHandlers ?? {
          v1: {
            "/signup": NpmServer.createHandlerPipe([
              ProxyServer.log,
              ProxyServer.handleApiSignup,
            ]),
            "/attach-token": NpmServer.createHandlerPipe([
              ProxyServer.log,
              ProxyServer.checkToken,
              ProxyServer.handleApiAttachToken,
              ProxyServer.dongle,
            ]),
          },
        },
        proxies: options?.proxies,
      }
    );
  }

  // Server methods
  public async readData(): Promise<void> {
    await this.npmServer.data.users.readAll();
    await this.npmServer.data.tokens.readAll();
    await this.npmServer.data.sessions.readAll();
  }

  // Common handlers
  static dongle: TrocRequestHandler = async (adapter) => {
    await adapter.res.sendBadRequest();
    return adapter;
  };

  static log: TrocRequestHandler = async (adapter) => {
    console.log(">", adapter.req.original.method?.padEnd(4), adapter.req.url);
    return adapter;
  };

  static checkToken: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.data.tokens.get(adapter.req.token))) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    return adapter;
  };

  static checkCredentials: TrocRequestHandler = async (adapter) => {
    const data = await adapter.req.json<NpmCredentials>();

    if (!data || !data.name || !data.password) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    const user = await adapter.data.users.get(data.name);

    if (!user || hmac(data.password) !== user.password) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    return adapter;
  };

  // Commands
  static handleCommandInstall: TrocRequestHandler = async (adapter) => {
    // audit
    if (adapter.req.url.startsWith("/-")) {
      await adapter.res.sendOk();
      return adapter;
    }

    if (adapter.req.parsedUrl.ext) {
      return await ProxyServer.handlerGettingTarball(adapter);
    }

    return await ProxyServer.handlerGettingInfo(adapter);
  };

  static handlerGettingTarball: TrocRequestHandler = async (adapter) => {
    if (await adapter.accessTarballFile()) {
      await adapter.res.sendOk({ end: await adapter.readTarballFile() });
      return adapter;
    }

    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...options.headers,
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        const data = await new RequestMeta(res).data();

        await adapter.createTarballDir();
        await adapter.writeTarballFile(adapter.paths.tarball.file, data);
        await adapter.res.sendOk({ end: data });

        return adapter;
      }
    }

    await adapter.res.sendNotFound();
    return adapter;
  };

  static handlerGettingInfo: TrocRequestHandler = async (adapter) => {
    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...options.headers,
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        const info = await new RequestMeta(res).json<PackageInfo>();

        if (info && !info.error) {
          const data = changeHostPackageInfo(info, adapter.req.headers.host);
          const dataJson = JSON.stringify(data, null, 2);

          await adapter.createInfoDir();
          await adapter.writeInfoFile(adapter.paths.info.file, dataJson);
          await adapter.res.sendOk({ end: dataJson });

          return adapter;
        }
      }
    }

    if (await adapter.accessInfoFile()) {
      await adapter.res.sendOk({ end: await adapter.readInfoFile() });
      return adapter;
    }

    await adapter.res.sendNotFound();
    return adapter;
  };

  static handleCommandView: TrocRequestHandler = async (adapter) => {
    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...removeProps(options.headers ?? {}, "accept-encoding"),
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        const info = await new RequestMeta(res).json<PackageInfo>();

        if (info && !info.error) {
          const data = changeHostPackageInfo(info, adapter.req.headers.host);
          const dataJson = JSON.stringify(data, null, 2);

          await adapter.createInfoDir();
          await adapter.writeInfoFile(adapter.paths.info.file, dataJson);
          await adapter.res.sendOk({ end: dataJson });

          return adapter;
        }
      }
    }

    if (await adapter.accessInfoFile()) {
      await adapter.res.sendOk({ end: await adapter.readInfoFile() });
      return adapter;
    }

    await adapter.res.sendNotFound();
    return adapter;
  };

  static handleCommandAdduser: TrocRequestHandler = async (adapter) => {
    const data = await adapter.req.json<NpmCredentials>();
    const token = generateToken();

    await adapter.data.tokens.set(token, { username: data?.name ?? "" });
    await adapter.res.sendOk({ end: JSON.stringify({ token }) });
    return adapter;
  };

  static handleCommandLogout: TrocRequestHandler = async (adapter) => {
    if (
      !adapter.req.token ||
      !(await adapter.data.tokens.get(adapter.req.token))
    ) {
      await adapter.res.sendOk();
      return adapter;
    }

    await adapter.data.tokens.remove(adapter.req.token);
    await adapter.data.sessions.remove(adapter.req.token);
    await adapter.res.sendOk();
    return adapter;
  };

  static handleCommandWhoami: TrocRequestHandler = async (adapter) => {
    const tokenData = await adapter.data.tokens.get(adapter.req.token);

    if (!tokenData) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    await adapter.res.sendOk({
      end: JSON.stringify({ username: tokenData.username }),
    });
    return adapter;
  };

  static handleCommandPublish: TrocRequestHandler = async (adapter) => {
    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...removeProps(options.headers ?? {}, "accept-encoding"),
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      console.log(ProxyServer.getAuthorization(session?.registries[targetUrl]));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        await adapter.res.sendOk({ end: await new RequestMeta(res).data() });
        return adapter;
      }
    }

    await adapter.res.sendBadRequest();
    return adapter;
  };

  // Api
  static handleApiSignup: TrocRequestHandler = RegistryServer.handleApiSignup;

  static handleApiAttachToken: TrocRequestHandler = async (adapter) => {
    const data = await adapter.req.json<{
      registryUrl: string;
      token: string;
    }>();

    if (!data) {
      await adapter.res.sendBadRequest();
      return adapter;
    }

    const session = (await adapter.data.sessions.get(adapter.req.token)) ?? {
      registries: {},
    };
    await adapter.data.sessions.set(adapter.req.token, {
      ...session,
      registries: {
        ...session.registries,
        [data.registryUrl]: data.token,
      },
    });

    await adapter.res.sendOk();
    return adapter;
  };

  // Utils
  static getAuthorization(token?: string): string {
    if (!token) return "";
    return `Bearer ${token}`;
  }
}
