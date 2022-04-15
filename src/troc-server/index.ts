import * as path from "path";

import { NpmRequestHandler, NpmServer, NpmServerOptions } from "../npm-server";
import { hmac } from "../utils/crypto";
import { JsonCache } from "../utils/json-cache";
import { NpmCredentials } from "../utils/npm";
import { RequestAdapter } from "../utils/request-adapter";

export type User = {
  password: string;
  email: string;
};

export type Tokens = {
  username: string;
};

export type Sessions = {
  registries: Record<string, string>;
};

export type TrocServerData = {
  users: JsonCache<User>;
  tokens: JsonCache<Tokens>;
  sessions: JsonCache<Sessions>;
};

export type TrocRequestHandler = NpmRequestHandler<TrocServerData>;

type NSOptions = NpmServerOptions<TrocServerData>;

export type TrocServerOptions = {
  server: NSOptions["server"];
  data?: NSOptions["data"];
  commandHandlers?: NSOptions["commandHandlers"];
  apiHandlers?: NSOptions["apiHandlers"];
  unknownHandler?: NSOptions["unknownHandler"];
  proxies?: NSOptions["proxies"];
  storageDir?: NSOptions["storageDir"];
  formatterPackageInfo?: NSOptions["formatterPackageInfo"];
};

export class TrocServer extends NpmServer<TrocServerData> {
  constructor(options: TrocServerOptions) {
    super({
      ...options,
      initHandler: () => this.readData(),
      data: TrocServer.buildServerData(options),
    });
  }

  // Server methods
  public async readData(): Promise<void> {
    await this.data.users.readAll();
    await this.data.tokens.readAll();
    await this.data.sessions.readAll();
  }

  // Utils
  static buildServerData(options?: TrocServerOptions): TrocServerData {
    if (options?.data) return options.data;

    const storageDir = options?.storageDir ?? RequestAdapter.storageDir;

    return {
      users: new JsonCache(path.join(storageDir, "users.json")),
      tokens: new JsonCache(path.join(storageDir, "tokens.json")),
      sessions: new JsonCache(path.join(storageDir, "sessions.json")),
    };
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

  // Api
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

// const config = new ServerConfig();
// const server = new TrocServer({
//   server: createServer(),
//   data: TrocServer.buildServerData(config),
//   config,
// });
