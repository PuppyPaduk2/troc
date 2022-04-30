import * as path from "path";

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

export type RegistryParams = {
  url: RegistryUrl;
  dir: RegistryDir;
  proxyConfigs: ProxyConfig[];
};

export class Registry {
  private _: RegistryParams;
  private users: Cache<UserData>;
  private tokens: Cache<TokenData>;

  constructor(params: RegistryParams) {
    this._ = params;
    this.users = new Cache<UserData>({
      file: this.getCacheFile("users.json"),
    });
    this.tokens = new Cache<TokenData>({
      file: this.getCacheFile("tokens.json"),
    });
  }

  private getCacheFile(file: File): File {
    return path.join(this.dir, file);
  }

  public get dir(): string {
    return this._.dir;
  }

  public get isProxy(): boolean {
    return Boolean(this._.proxyConfigs.length);
  }

  public async readCache(): Promise<void> {
    const { users, tokens } = this;
    await Promise.allSettled([users.read(), tokens.read()]);
    await Promise.allSettled([users.write(), tokens.write()]);
  }

  public async getUser(name: Username): Promise<UserData | null> {
    return await this.users.get(name);
  }

  public async setUser(name: Username, userData: UserData): Promise<void> {
    await this.users.set(name, userData);
    await this.users.writeRecord(name, userData);
  }

  public async setToken(token: Token, tokenData: TokenData): Promise<void> {
    await this.tokens.set(token, tokenData);
    await this.tokens.writeRecord(token, tokenData);
  }

  public async getToken(token: Token): Promise<TokenData | null> {
    return await this.tokens.get(token);
  }

  public async isCorrectToken(token: Token): Promise<boolean> {
    return await this.tokens.has(token);
  }

  public getProxyUrls(params: {
    pkgScope: string;
    pkgName: string;
    npmCommand: string;
  }): string[] {
    const { pkgScope, pkgName, npmCommand } = params;
    const filteredUrls: string[] = [];

    for (const config of this._.proxyConfigs) {
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
