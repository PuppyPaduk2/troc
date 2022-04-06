import * as path from "path";
import { RegistryTokenData, Token, TokenData, UserData } from "./data-storage";
import { readJson, writeJson } from "./fs";

export type ServerConfigParams = {
  storageDir: string;
  proxies: Proxy[];
};

export type Proxy = {
  url: string;
  names?: string[];
  scopes?: string[];
  commands?: string[];
};

export class ServerConfig {
  private params: ServerConfigParams = {
    storageDir: path.join(__dirname, "storage"),
    proxies: [],
  };

  constructor(params?: Partial<ServerConfigParams>) {
    this.params = { ...this.params, ...params };
  }

  public get storageDir(): string {
    return this.params.storageDir;
  }

  public get registryDir(): string {
    return path.join(this.storageDir, "registry");
  }

  public get usersFile(): string {
    return path.join(this.storageDir, "users.json");
  }

  public get tokensFile(): string {
    return path.join(this.storageDir, "tokens.json");
  }

  public get registryTokensFile(): string {
    return path.join(this.storageDir, "registry-tokens.json");
  }

  public async readTokens(): Promise<[Token, TokenData][]> {
    return (await readJson(this.tokensFile)) ?? [];
  }

  public async writeTokens(data: [Token, TokenData][]): Promise<void> {
    await writeJson(this.tokensFile, data, null, 2);
  }

  public async readUsers(): Promise<[string, UserData][]> {
    return (await readJson(this.usersFile)) ?? [];
  }

  public async writeUsers(data: [string, UserData][]): Promise<void> {
    await writeJson(this.usersFile, data, null, 2);
  }

  public async readRegistryTokens(): Promise<[Token, RegistryTokenData][]> {
    return (await readJson(this.registryTokensFile)) ?? [];
  }

  public async writeRegistryTokens(
    data: [Token, RegistryTokenData][]
  ): Promise<void> {
    await writeJson(this.registryTokensFile, data, null, 2);
  }

  public getProxyUrls(params?: {
    name?: string;
    scope?: string;
    command?: string;
  }): string[] {
    const { name, scope, command } = params ?? {};
    const filteredUrls: string[] = [];

    for (const config of this.params.proxies) {
      const { names = [], scopes = [], commands = [] } = config;
      const isName = Boolean(name && names.includes(name)) || !names.length;
      const isScope =
        Boolean(scope && scopes.includes(scope)) || !scopes.length;
      const isCommand =
        Boolean(command && commands.includes(command)) || !commands.length;
      const isAll = !names.length && !scopes.length && !commands.length;

      if ((isName && isScope && isCommand) || isAll) {
        filteredUrls.push(config.url);
      }
    }

    return Array.from(new Set(filteredUrls));
  }
}
