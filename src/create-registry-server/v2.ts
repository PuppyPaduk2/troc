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
  RequestHandler,
  ServerApiHandlers,
  ServerCommandHandlers,
} from "../utils/v2/npm-server";
import { ServerConfig } from "../utils/v2/server-config";
import { JsonCache } from "../utils/v2/json-cache";

type User = {
  password: string;
  email: string;
};

type RegistryServerData = {
  users: JsonCache<User>;
  tokens: JsonCache<{
    username: string;
  }>;
  sessions: JsonCache<{
    registries: Record<string, string>;
  }>;
};

export class RegistryServer {
  public server: Server;
  public npmServer: NpmServer<RegistryServerData>;

  constructor(options?: {
    server?: Server;
    config?: ServerConfig;
    data?: RegistryServerData;
    commandHandlers?: Partial<ServerCommandHandlers<RegistryServerData>>;
    apiHandlers?: ServerApiHandlers<RegistryServerData>;
  }) {
    const config = options?.config ?? new ServerConfig();

    this.server = options?.server ?? createServer();
    this.npmServer = new NpmServer<RegistryServerData>(
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
              install: RegistryServer.createHandler((adapter) =>
                Promise.resolve(adapter)
                  .then(RegistryServer.log)
                  .then(RegistryServer.handleCommandInstall)
              ),
              publish: RegistryServer.createHandler((adapter) =>
                Promise.resolve(adapter)
                  .then(RegistryServer.log)
                  .then(RegistryServer.handleCommandPublish)
              ),
              view: RegistryServer.createHandler((adapter) =>
                Promise.resolve(adapter)
                  .then(RegistryServer.log)
                  .then(RegistryServer.handleCommandView)
              ),
              adduser: RegistryServer.createHandler((adapter) =>
                Promise.resolve(adapter)
                  .then(RegistryServer.log)
                  .then(RegistryServer.handleCommandAdduser)
              ),
              logout: RegistryServer.createHandler((adapter) =>
                Promise.resolve(adapter)
                  .then(RegistryServer.log)
                  .then(RegistryServer.handleCommandLogout)
              ),
              whoami: RegistryServer.createHandler((adapter) =>
                Promise.resolve(adapter)
                  .then(RegistryServer.log)
                  .then(RegistryServer.handleCommandWhoami)
              ),
            },
        apiHandlers: options?.apiHandlers ?? {
          v1: {
            "/signup": RegistryServer.handleApiSignup,
            "/create-token": RegistryServer.handleApiCreateToken,
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

  static createHandler(
    handler: RequestHandler<RegistryServerData>
  ): RequestHandler<RegistryServerData> {
    return NpmServer.createHandler<RegistryServerData>(handler);
  }

  static dongle = RegistryServer.createHandler(async (adapter) => {
    await adapter.res.sendBadRequest();
    return adapter;
  });

  static log = RegistryServer.createHandler(async (adapter) => {
    const { req } = adapter;

    console.log(">", req.original.method?.padEnd(4), req.url);
    return adapter;
  });

  static checkCredentials = RegistryServer.createHandler(async (adapter) => {
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
  });

  static checkMethod: (
    methods: string[]
  ) => RequestHandler<RegistryServerData> = (methods) =>
    RegistryServer.createHandler(async (adapter) => {
      const { req, res } = adapter;

      if (!methods.includes(req.original.method ?? "")) {
        await res.sendBadRequest();
        return adapter;
      }

      return adapter;
    });

  static checkToken = RegistryServer.createHandler(async (adapter) => {
    if (!(await adapter.data.tokens.get(adapter.req.token))) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    return adapter;
  });

  static createToken = RegistryServer.createHandler(async (adapter) => {
    const { req, res } = adapter;
    const data = await req.json<NpmCredentials>();
    const token = generateToken();

    await adapter.data.tokens.set(token, { username: data?.name ?? "" });
    await res.sendOk({ end: JSON.stringify({ token }) });
    return adapter;
  });

  static handleCommandInstall = RegistryServer.createHandler(
    async (adapter) => {
      return Promise.resolve(adapter)
        .then(RegistryServer.checkToken)
        .then(async () => {
          // audit
          if (adapter.req.url.startsWith("/-")) {
            await adapter.res.sendOk();
            return adapter;
          }

          if (adapter.req.parsedUrl.ext) {
            return await RegistryServer.handlerGettingTarball(adapter);
          }

          return await RegistryServer.handlerGettingInfo(adapter);
        });
    }
  );

  static handlerGettingTarball = RegistryServer.createHandler(
    async (adapter) => {
      if (!(await adapter.accessTarballFile())) {
        await adapter.res.sendNotFound();
        return adapter;
      }

      await adapter.res.sendOk({ data: await adapter.readTarballFile() });
      return adapter;
    }
  );

  static handlerGettingInfo = RegistryServer.createHandler(async (adapter) => {
    if (!(await adapter.accessInfoFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readInfoFile() });
    return adapter;
  });

  static handleCommandPublish = RegistryServer.createHandler(
    async (adapter) => {
      return Promise.resolve(adapter).then(async () => {
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
      });
    }
  );

  static handleCommandView = RegistryServer.createHandler(async (adapter) => {
    return Promise.resolve(adapter)
      .then(RegistryServer.checkToken)
      .then(async () => {
        if (!(await adapter.accessInfoFile())) {
          await adapter.res.sendNotFound();
          return adapter;
        }

        await adapter.res.sendOk({ data: await adapter.readInfoFile() });
        return adapter;
      });
  });

  static handleCommandAdduser = RegistryServer.createHandler(
    async (adapter) => {
      return await RegistryServer.handleApiCreateToken(adapter);
    }
  );

  static handleCommandLogout = RegistryServer.createHandler(async (adapter) => {
    const { req, res, data: db } = adapter;

    if (!req.token || !(await db.tokens.get(req.token))) {
      await res.sendOk();
      return adapter;
    }

    await db.tokens.remove(req.token);
    await res.sendOk();
    return adapter;
  });

  static handleCommandWhoami = RegistryServer.createHandler(async (adapter) => {
    return Promise.resolve(adapter).then(async () => {
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
    });
  });

  static handleApiSignup = RegistryServer.createHandler(async (adapter) => {
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
  });

  static handleApiCreateToken = RegistryServer.createHandler(
    async (adapter) => {
      return Promise.resolve(adapter)
        .then(RegistryServer.checkMethod(["POST", "PUT"]))
        .then(RegistryServer.checkCredentials)
        .then(RegistryServer.createToken);
    }
  );
}
