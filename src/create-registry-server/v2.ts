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

const createRequestHandler = (
  handler: RequestHandler<void, RegistryServerData>
) =>
  NpmServer.createRequestHandler<void, RegistryServerData>(async (adapter) => {
    const { req } = adapter;

    console.log(">", req.original.method?.padEnd(4), req.url);

    return await handler(adapter);
  });

export class RegistryServer {
  public server: Server;
  public npmServer: NpmServer<RegistryServerData>;

  constructor(options?: {
    server?: Server;
    config?: ServerConfig;
    data?: RegistryServerData;
    commandHandlers?: ServerCommandHandlers;
    apiHandlers?: ServerApiHandlers;
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
        commandHandlers: options?.commandHandlers ?? {
          install: RegistryServer.handleCommandInstall,
          publish: RegistryServer.handleCommandPublish,
          view: RegistryServer.handleCommandView,
          adduser: RegistryServer.handleCommandAdduser,
          logout: RegistryServer.handleCommandLogout,
          whoami: RegistryServer.handleCommandWhoami,
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

  static handleCommandInstall = createRequestHandler(async (adapter) => {
    const isCorrectToken = await checkToken(adapter);

    if (!isCorrectToken) return await adapter.res.sendUnauthorized();

    // audit
    if (adapter.req.url.startsWith("/-")) {
      return await adapter.res.sendOk();
    }

    if (adapter.req.parsedUrl.ext) {
      return await RegistryServer.handlerGettingTarball(adapter);
    }

    return await RegistryServer.handlerGettingInfo(adapter);
  });

  static handlerGettingTarball = createRequestHandler(async (adapter) => {
    if (!(await adapter.accessTarballFile())) {
      return await adapter.res.sendNotFound();
    }

    return await adapter.res.sendOk({ data: await adapter.readTarballFile() });
  });

  static handlerGettingInfo = createRequestHandler(async (adapter) => {
    if (!(await adapter.accessInfoFile())) {
      return await adapter.res.sendNotFound();
    }

    return await adapter.res.sendOk({ data: await adapter.readInfoFile() });
  });

  static handleCommandPublish = createRequestHandler(async (adapter) => {
    const isCorrectToken = await checkToken(adapter);

    if (!isCorrectToken) return await adapter.res.sendUnauthorized();

    const pkgInfo: NpmPackageInfoPublish = (await adapter.req.json()) ?? {
      versions: {},
      _attachments: {},
    };

    await adapter.createTarballDir();

    const attachments = Object.entries(pkgInfo?._attachments ?? {});

    for (const [fileName, { data }] of attachments) {
      const file = path.join(adapter.paths.tarball.dir, fileName);

      if (await accessSoft(file)) {
        return adapter.res.sendBadRequest();
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

    return await adapter.res.sendOk();
  });

  static handleCommandView = createRequestHandler(async (adapter) => {
    const isCorrectToken = await checkToken(adapter);

    if (!isCorrectToken) return await adapter.res.sendUnauthorized();

    if (!(await adapter.accessInfoFile())) {
      return await adapter.res.sendNotFound();
    }

    return await adapter.res.sendOk({ data: await adapter.readInfoFile() });
  });

  static handleCommandAdduser = createRequestHandler(async (adapter) => {
    return await RegistryServer.handleApiCreateToken(adapter);
  });

  static handleCommandLogout = createRequestHandler(async (adapter) => {
    const { req, res, data: db } = adapter;

    if (!req.token) return await res.sendOk();
    if (!(await db.tokens.get(req.token))) return await res.sendOk();

    await db.tokens.remove(req.token);
    return await res.sendOk();
  });

  static handleCommandWhoami = createRequestHandler(async (adapter) => {
    const { req, res, data: db } = adapter;
    const tokenData = await db.tokens.get(req.token);

    if (!tokenData) return await res.sendUnauthorized();

    return await res.sendOk({
      end: JSON.stringify({ username: tokenData.username }),
    });
  });

  static handleApiSignup = createRequestHandler(async (adapter) => {
    const { req, res, data: db } = adapter;

    if (req.original.method !== "POST") return await res.sendBadRequest();

    const data = await req.json<{
      username?: string;
      password?: string;
      email?: string;
    }>();

    if (!data || !data.username || !data.password || !data.email) {
      return await res.sendBadRequest();
    }

    const username = data.username.toLocaleLowerCase();

    if (await db.users.get(username)) return await res.sendBadRequest();

    await db.users.set(username, {
      password: hmac(data.password),
      email: data.email,
    });

    return await res.sendOk();
  });

  static handleApiCreateToken = createRequestHandler(async (adapter) => {
    const { req, res } = adapter;
    const { method } = req.original;

    if (method !== "POST" && method !== "PUT") {
      return await res.sendBadRequest();
    }

    const token = await createToken(adapter);

    if (!token) return await res.sendUnauthorized();

    return await res.sendOk({ end: JSON.stringify({ token }) });
  });
}

const createToken = NpmServer.createRequestHandler<
  string | null,
  RegistryServerData
>(async (adapter) => {
  const user = await checkUserCredentials(adapter);

  if (!user) return null;

  const token = generateToken();
  await adapter.data.tokens.set(token, { username: user.name });

  return token;
});

const checkUserCredentials = NpmServer.createRequestHandler<
  (User & { name: string }) | null,
  RegistryServerData
>(async (adapter) => {
  const { req, data: db } = adapter;
  const data = await req.json<NpmCredentials>();

  if (!data || !data.name || !data.password) return null;

  const user = await db.users.get(data.name);

  if (!user) return null;
  if (hmac(data.password) !== user.password) return null;

  return { ...user, name: data.name };
});

const checkToken = NpmServer.createRequestHandler<boolean, RegistryServerData>(
  async (adapter) => {
    return Boolean(await adapter.data.tokens.get(adapter.req.token));
  }
);
