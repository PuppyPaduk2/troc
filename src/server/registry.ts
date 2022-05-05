import * as path from "path";
import { NpmPackageInfo, NpmPackageInfoFull } from "../utils/npm";

import { Cache, File } from "./cache";

export type RegistryUrl = string;

export type RegistryDir = string;

export type Username = string;

export type UserData = {
  password: string;
  email: string;
};

export type Token = string;

export type TokenData = {
  username: string;
};

export type SessionData = {
  registries: Record<string, string>;
};

export type ProxyConfig = {
  url: string;
  names?: string[];
  scopes?: string[];
  commands?: string[];
  exclude?: {
    names?: string[];
    scopes?: string[];
    commands?: string[];
  };
};

export type RegistryParams<Adapter> = {
  url: RegistryUrl;
  dir: RegistryDir;
  proxyConfigs: ProxyConfig[];
  hooks: Partial<RegistryHooks<Adapter>>;
};

export type RegistryHooks<Adapter> = {
  formatPackageInfo: (
    info: NpmPackageInfoFull,
    adapter: Adapter
  ) => Promise<NpmPackageInfo>;
};

export class Registry<Adapter> {
  private _params: RegistryParams<Adapter>;
  private _users: Cache<UserData>;
  private _tokens: Cache<TokenData>;
  private _sessions: Cache<SessionData>;
  private _hooks: RegistryHooks<Adapter> = {
    formatPackageInfo: async (info) => info,
  };

  constructor(params: RegistryParams<Adapter>) {
    this._params = params;
    this._users = new Cache<UserData>({
      file: this._getCacheFile("users.json"),
    });
    this._tokens = new Cache<TokenData>({
      file: this._getCacheFile("tokens.json"),
    });
    this._sessions = new Cache<SessionData>({
      file: this._getCacheFile("sessions.json"),
    });
  }

  private _getCacheFile(file: File): File {
    return path.join(this.dir, file);
  }

  public get dir(): string {
    return this._params.dir;
  }

  public get packagesDir(): string {
    return path.join(this.dir, "packages");
  }

  public get isProxy(): boolean {
    return Boolean(this._params.proxyConfigs.length);
  }

  public get hooks(): RegistryHooks<Adapter> {
    return {
      formatPackageInfo: (info, adapter) => {
        const handler =
          this._params.hooks.formatPackageInfo ?? this._hooks.formatPackageInfo;
        return handler(info, adapter);
      },
    };
  }

  public async readCache(): Promise<void> {
    const { _users, _tokens, _sessions } = this;
    await Promise.allSettled([_users.read(), _tokens.read(), _sessions.read()]);
    await Promise.allSettled([
      _users.write(),
      _tokens.write(),
      _sessions.write(),
    ]);
  }

  public async getUser(name: Username): Promise<UserData | null> {
    return await this._users.get(name);
  }

  public async setUser(name: Username, userData: UserData): Promise<void> {
    await this._users.set(name, userData);
    await this._users.writeRecord(name, userData);
  }

  public async setToken(token: Token, tokenData: TokenData): Promise<void> {
    await this._tokens.set(token, tokenData);
    await this._tokens.writeRecord(token, tokenData);
  }

  public async getToken(token: Token): Promise<TokenData | null> {
    return await this._tokens.get(token);
  }

  public async removeToken(token: Token): Promise<boolean> {
    const result = await this._tokens.remove(token);
    await this._tokens.write();
    return result;
  }

  public async isCorrectToken(token: Token): Promise<boolean> {
    return await this._tokens.has(token);
  }

  public async setSession(
    token: Token,
    sessionData: SessionData
  ): Promise<void> {
    await this._sessions.set(token, sessionData);
    await this._sessions.writeRecord(token, sessionData);
  }

  public async getSession(token: Token): Promise<SessionData | null> {
    return await this._sessions.get(token);
  }

  public async addSessionRegistry(
    token: Token,
    registryUrl: string,
    registryToken: string
  ): Promise<boolean> {
    const sessionData = await this.getSession(token);
    const registries = {
      ...(sessionData?.registries ?? {}),
      [registryUrl]: registryToken,
    };
    await this.setSession(token, { ...sessionData, registries });
    return true;
  }

  public async removeSession(token: Token): Promise<boolean> {
    const result = await this._sessions.remove(token);
    await this._sessions.write();
    return result;
  }

  public getProxyUrls(params: {
    pkgScope: string;
    pkgName: string;
    npmCommand: string;
  }): string[] {
    const { pkgScope, pkgName, npmCommand } = params;
    const filteredUrls: string[] = [];

    for (const config of this._params.proxyConfigs) {
      if (
        !config.exclude?.scopes?.includes(pkgScope) &&
        !config.exclude?.names?.includes(pkgName) &&
        !config.exclude?.commands?.includes(npmCommand)
      ) {
        const { scopes = [], names = [], commands = [] } = config;

        const isAnyScope = !scopes.length;
        const isScope = Boolean(scopes.includes(pkgScope)) || isAnyScope;

        const isAnyName = !names.length;
        const isName = Boolean(names.includes(pkgName)) || isAnyName;

        const isAnyCommand = !commands.length;
        const isCommand =
          Boolean(commands.includes(npmCommand)) || isAnyCommand;

        const isAll = isAnyName && isAnyScope && isAnyCommand;

        if ((isName && isScope && isCommand) || isAll) {
          filteredUrls.push(config.url);
        }
      }
    }

    return Array.from(new Set(filteredUrls));
  }
}
