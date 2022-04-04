import * as path from "path";
import { TokenData, UserData } from "./data-storage";
import { readJson, writeJson } from "./fs";

export type ServerConfigParams = {
  storageDir: string;
};

export class ServerConfig {
  private params: ServerConfigParams = {
    storageDir: path.join(__dirname, "storage"),
  };

  constructor(params?: Partial<ServerConfigParams>) {
    this.params = { ...this.params, ...params };
  }

  public get storageDir() {
    return this.params.storageDir;
  }

  public get registryDir() {
    return path.join(this.storageDir, "registry");
  }

  public get usersFile() {
    return path.join(this.storageDir, "users.json");
  }

  public get tokensFile() {
    return path.join(this.storageDir, "tokens.json");
  }

  public async readTokens(): Promise<[string, TokenData][]> {
    return (await readJson(this.tokensFile)) ?? [];
  }

  public async writeTokens(tokens: [string, TokenData][]): Promise<void> {
    await writeJson(this.tokensFile, tokens, null, 2);
  }

  public async readUsers(): Promise<[string, UserData][]> {
    return (await readJson(this.usersFile)) ?? [];
  }

  public async writeUsers(users: [string, UserData][]): Promise<void> {
    await writeJson(this.usersFile, users, null, 2);
  }
}
