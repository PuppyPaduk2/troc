import { createServer, Server } from "http";
import * as merge from "merge";
import * as path from "path";

import { generateToken, hmac } from "../utils/crypto";
import { accessSoft } from "../utils/fs";
import {
  NpmCredentials,
  NpmPackageInfo,
  NpmPackageInfoPublish,
} from "../utils/npm";
import { removeProps } from "../utils/object";
import {
  NpmServer,
  ServerApiHandlers,
  ServerCommandHandlers,
} from "../utils/v2/npm-server";
import { ServerConfig } from "../utils/v2/server-config";
import { JsonCache } from "../utils/v2/json-cache";
import { TrocRequestHandler, TrocServerData } from "../types";

export class RegistryServer {
  public server: Server;
  public npmServer: NpmServer<TrocServerData>;

  constructor(options?: {
    server?: Server;
    config?: ServerConfig;
    data?: TrocServerData;
    commandHandlers?: Partial<ServerCommandHandlers<TrocServerData>>;
    apiHandlers?: ServerApiHandlers<TrocServerData>;
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
              install: RegistryServer.dongle,
              publish: RegistryServer.dongle,
              view: RegistryServer.dongle,
              adduser: RegistryServer.dongle,
              logout: RegistryServer.dongle,
              whoami: RegistryServer.dongle,
              ...options.commandHandlers,
            }
          : {
              install: NpmServer.createHandlerPipe([
                RegistryServer.log,
                RegistryServer.checkToken,
                RegistryServer.handleCommandInstall,
              ]),
              publish: NpmServer.createHandlerPipe([
                RegistryServer.log,
                RegistryServer.checkToken,
                RegistryServer.handleCommandPublish,
              ]),
              view: NpmServer.createHandlerPipe([
                RegistryServer.log,
                RegistryServer.checkToken,
                RegistryServer.handleCommandView,
              ]),
              adduser: NpmServer.createHandlerPipe([
                RegistryServer.log,
                RegistryServer.checkMethod(["POST", "PUT"]),
                RegistryServer.checkCredentials,
                RegistryServer.handleCommandAdduser,
              ]),
              logout: NpmServer.createHandlerPipe([
                RegistryServer.log,
                RegistryServer.handleCommandLogout,
              ]),
              whoami: NpmServer.createHandlerPipe([
                RegistryServer.log,
                RegistryServer.checkToken,
                RegistryServer.handleCommandWhoami,
              ]),
            },
        apiHandlers: options?.apiHandlers ?? {
          v1: {
            "/signup": NpmServer.createHandlerPipe([
              RegistryServer.log,
              RegistryServer.handleApiSignup,
            ]),
          },
        },
      }
    );
  }

  public async readData(): Promise<void> {
    const { users, tokens, sessions } = this.npmServer.data;

    await users.readAll();
    await tokens.readAll();
    await sessions.readAll();
  }

  static dongle: TrocRequestHandler = async (adapter) => {
    await adapter.res.sendBadRequest();
    return adapter;
  };

  static log: TrocRequestHandler = async (adapter) => {
    const { req } = adapter;

    console.log(">", req.original.method?.padEnd(4), req.url);
    return adapter;
  };

  static checkCredentials: TrocRequestHandler = async (adapter) => {
    const { req, res, data: db } = adapter;
    const data = await req.json<NpmCredentials>();

    if (!data || !data.name || !data.password) {
      await res.sendUnauthorized();
      return adapter;
    }

    const user = await db.users.get(data.name);

    if (!user || hmac(data.password) !== user.password) {
      await res.sendUnauthorized();
      return adapter;
    }

    return adapter;
  };

  static checkMethod: (methods: string[]) => TrocRequestHandler = (methods) => {
    return async (adapter) => {
      const { req, res } = adapter;

      if (!methods.includes(req.original.method ?? "")) {
        await res.sendBadRequest();
        return adapter;
      }

      return adapter;
    };
  };

  static checkToken: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.data.tokens.get(adapter.req.token))) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    return adapter;
  };

  static handleCommandInstall: TrocRequestHandler = async (adapter) => {
    // audit
    if (adapter.req.url.startsWith("/-")) {
      await adapter.res.sendOk();
      return adapter;
    }

    if (adapter.req.parsedUrl.ext) {
      return await RegistryServer.handlerGettingTarball(adapter);
    }

    return await RegistryServer.handlerGettingInfo(adapter);
  };

  static handlerGettingTarball: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.accessTarballFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readTarballFile() });
    return adapter;
  };

  static handlerGettingInfo: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.accessInfoFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readInfoFile() });
    return adapter;
  };

  static handleCommandPublish: TrocRequestHandler = async (adapter) => {
    const pkgInfo: NpmPackageInfoPublish = (await adapter.req.json()) ?? {
      versions: {},
      _attachments: {},
    };

    await adapter.createTarballDir();

    const attachments = Object.entries(pkgInfo?._attachments ?? {});

    for (const [fileName, { data }] of attachments) {
      const file = path.join(adapter.paths.tarball.dir, fileName);

      if (await accessSoft(file)) {
        await adapter.res.sendBadRequest();
        return adapter;
      }

      await adapter.writeTarballFile(file, data);
    }

    const currInfo = await adapter.readInfoFileJson();
    const nextInfo: NpmPackageInfo = merge.recursive(
      currInfo,
      removeProps(pkgInfo, "_attachments")
    );

    await adapter.writeInfoFile(
      adapter.paths.info.file,
      JSON.stringify(nextInfo, null, 2)
    );

    await adapter.res.sendOk();
    return adapter;
  };

  static handleCommandView: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.accessInfoFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readInfoFile() });
    return adapter;
  };

  static handleCommandAdduser: TrocRequestHandler = async (adapter) => {
    const { req, res } = adapter;
    const data = await req.json<NpmCredentials>();
    const token = generateToken();

    await adapter.data.tokens.set(token, { username: data?.name ?? "" });
    await res.sendOk({ end: JSON.stringify({ token }) });
    return adapter;
  };

  static handleCommandLogout: TrocRequestHandler = async (adapter) => {
    const { req, res, data: db } = adapter;

    if (!req.token || !(await db.tokens.get(req.token))) {
      await res.sendOk();
      return adapter;
    }

    await db.tokens.remove(req.token);
    await res.sendOk();
    return adapter;
  };

  static handleCommandWhoami: TrocRequestHandler = async (adapter) => {
    const { req, res, data: db } = adapter;
    const tokenData = await db.tokens.get(req.token);

    if (!tokenData) {
      await res.sendUnauthorized();
      return adapter;
    }

    await res.sendOk({
      end: JSON.stringify({ username: tokenData.username }),
    });
    return adapter;
  };

  static handleApiSignup: TrocRequestHandler = async (adapter) => {
    const { req, res, data: db } = adapter;

    if (req.original.method !== "POST") {
      await res.sendBadRequest();
      return adapter;
    }

    const data = await req.json<{
      username?: string;
      password?: string;
      email?: string;
    }>();

    if (!data || !data.username || !data.password || !data.email) {
      await res.sendBadRequest();
      return adapter;
    }

    const username = data.username.toLocaleLowerCase();

    if (await db.users.get(username)) {
      await res.sendBadRequest();
      return adapter;
    }

    await db.users.set(username, {
      password: hmac(data.password),
      email: data.email,
    });

    await res.sendOk();
    return adapter;
  };
}
