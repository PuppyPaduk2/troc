import * as path from "path";
import { Cache } from "./cache";

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

export class RegistryCache {
  private _dir: string;
  private _data: {
    users: {
      cache: Cache<UserData>;
      initialReading: Promise<void> | null;
    };
    tokens: {
      cache: Cache<TokenData>;
      initialReading: Promise<void> | null;
    };
    sessions: {
      cache: Cache<SessionData>;
      initialReading: Promise<void> | null;
    };
  };

  constructor(dir: string) {
    this._dir = dir;
    this._data = {
      users: {
        cache: new Cache<UserData>({
          file: this._getCacheFile("users.json"),
        }),
        initialReading: null,
      },
      tokens: {
        cache: new Cache<TokenData>({
          file: this._getCacheFile("tokens.json"),
        }),
        initialReading: null,
      },
      sessions: {
        cache: new Cache<SessionData>({
          file: this._getCacheFile("sessions.json"),
        }),
        initialReading: null,
      },
    };
  }

  private _getCacheFile(file: string): string {
    return path.join(this._dir, file);
  }

  private async _initReadingUsers(): Promise<void> {
    this._data.users.initialReading =
      this._data.users.initialReading ?? this._users.read();
    await this._data.users.initialReading;
  }

  private async _initReadingTokens(): Promise<void> {
    this._data.tokens.initialReading =
      this._data.tokens.initialReading ?? this._tokens.read();
    await this._data.tokens.initialReading;
  }

  private async _initReadingSessions(): Promise<void> {
    this._data.sessions.initialReading =
      this._data.sessions.initialReading ?? this._sessions.read();
    await this._data.sessions.initialReading;
  }

  // Users
  private get _users(): Cache<UserData> {
    return this._data.users.cache;
  }

  public async getUser(name: Username): Promise<UserData | null> {
    await this._initReadingUsers();
    return await this._users.get(name);
  }

  public async setUser(name: Username, userData: UserData): Promise<void> {
    await this._users.set(name, userData);
    await this._users.writeRecord(name, userData);
  }

  // Tokens
  private get _tokens(): Cache<TokenData> {
    return this._data.tokens.cache;
  }

  public async setToken(token: Token, tokenData: TokenData): Promise<void> {
    await this._tokens.set(token, tokenData);
    await this._tokens.writeRecord(token, tokenData);
  }

  public async getToken(token: Token): Promise<TokenData | null> {
    await this._initReadingTokens();
    return await this._tokens.get(token);
  }

  public async removeToken(token: Token): Promise<boolean> {
    const result = await this._tokens.remove(token);
    await this._tokens.write();
    return result;
  }

  public async isCorrectToken(token: Token): Promise<boolean> {
    await this._initReadingTokens();
    return await this._tokens.has(token);
  }

  // Sessions
  private get _sessions(): Cache<SessionData> {
    return this._data.sessions.cache;
  }

  public async setSession(
    token: Token,
    sessionData: SessionData
  ): Promise<void> {
    await this._sessions.set(token, sessionData);
    await this._sessions.writeRecord(token, sessionData);
  }

  public async getSession(token: Token): Promise<SessionData | null> {
    await this._initReadingSessions();
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
}
