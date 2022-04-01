import * as path from "path";

import { readJson, writeJson } from "./fs";
import { ServerConfig } from "./server-config";
import { generateToken, hmac } from "./crypto";

export class Users extends Map<string, UserData> {
  constructor(rawUsers: [string, UserData][] = []) {
    super(Users.deserialize(rawUsers));
  }

  static deserialize(rawUsers: [string, UserData][]): [string, UserData][] {
    return rawUsers;
  }

  static serialize(users: Users): [string, UserData][] {
    return Array.from(users);
  }

  static password(value: string): string {
    return hmac(value);
  }
}

export type UserData = {
  password: string;
  email: string;
};

export class Tokens extends Map<string, TokenData> {
  constructor(rawTokens: [string, TokenData][] = []) {
    super(Tokens.deserialize(rawTokens));
  }

  public create(data: TokenData): string {
    const token = generateToken();

    this.set(token, data);

    return token;
  }

  static deserialize(rawTokens: [string, TokenData][]): [string, TokenData][] {
    return rawTokens;
  }

  static serialize(tokens: Tokens): [string, TokenData][] {
    return Array.from(tokens);
  }

  static generateToken(): string {
    return generateToken();
  }
}

export type TokenData = {
  username: string;
};

export class InfraStorage {
  public users: Users = new Users();
  public tokens: Tokens = new Tokens();
  public serverConfig: ServerConfig;

  constructor(params: { serverConfig: ServerConfig }) {
    this.serverConfig = params.serverConfig;
  }

  public get paths(): { usersFile: string; tokensFile: string } {
    const { storageDir } = this.serverConfig;

    return {
      usersFile: path.join(storageDir, "users.json"),
      tokensFile: path.join(storageDir, "tokens.json"),
    };
  }

  public async readTokens(): Promise<void> {
    this.tokens = new Tokens(
      (await readJson<[string, TokenData][]>(this.paths.tokensFile)) ?? []
    );
  }

  public async writeTokens(): Promise<void> {
    await writeJson(
      this.paths.tokensFile,
      Tokens.serialize(this.tokens),
      null,
      2
    );
  }

  public async readUsers(): Promise<void> {
    this.users = new Users(
      (await readJson<[string, UserData][]>(this.paths.usersFile)) ?? []
    );
  }

  public async writeUsers(): Promise<void> {
    await writeJson(this.paths.usersFile, Users.serialize(this.users), null, 2);
  }
}
