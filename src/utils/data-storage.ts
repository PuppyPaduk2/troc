import { generateToken, hmac } from "./crypto";

export type Cache = {
  users: Map<string, UserData>;
  tokens: Map<string, TokenData>;
};

export type UserData = {
  password: string;
  email: string;
};

export type TokenData = {
  username: string;
};

export type Handlers = {
  onChange: <Name extends keyof Cache>(
    name: Name,
    type: "set" | "create" | "delete"
  ) => Promise<void>;
};

export class DataStorage {
  public cache: Cache;
  public handlers: Handlers;

  constructor(
    params?: {
      users?: [string, UserData][];
      tokens?: [string, TokenData][];
    },
    handlers?: Partial<Handlers>
  ) {
    this.cache = {
      users: new Map(params?.users ?? []),
      tokens: new Map(params?.tokens ?? []),
    };
    this.handlers = {
      onChange: () => Promise.resolve(),
      ...handlers,
    };
  }

  public get users() {
    return {
      set: async (login: string, data: UserData): Promise<void> => {
        this.cache.users.set(login, data);
        await this.handlers.onChange("users", "set");
      },
      get: async (login: string): Promise<UserData | null> => {
        return this.cache.users.get(login) ?? null;
      },
      has: async (login: string): Promise<boolean> => {
        return this.cache.users.has(login);
      },
      serialize: async (): Promise<[string, UserData][]> => {
        return await DataStorage.usersUtils.serialize(this.cache.users);
      },
    };
  }

  public get tokens() {
    return {
      set: async (token: string, tokenData: TokenData): Promise<void> => {
        this.cache.tokens.set(token, tokenData);
        await this.handlers.onChange("tokens", "set");
      },
      create: async (tokenData: TokenData): Promise<string> => {
        const token = generateToken();
        this.cache.tokens.set(token, tokenData);
        await this.handlers.onChange("tokens", "create");
        return token;
      },
      get: async (token: string): Promise<TokenData | null> => {
        return this.cache.tokens.get(token) ?? null;
      },
      has: async (token: string): Promise<boolean> => {
        return this.cache.tokens.has(token);
      },
      delete: async (token: string): Promise<boolean> => {
        await this.handlers.onChange("tokens", "delete");
        return this.cache.tokens.delete(token);
      },
      serialize: async (): Promise<[string, TokenData][]> => {
        return await DataStorage.tokensUtils.serialize(this.cache.tokens);
      },
    };
  }

  static usersUtils = {
    deserialize(rawUsers: [string, UserData][]): Promise<[string, UserData][]> {
      return Promise.resolve(rawUsers);
    },
    serialize(users: Cache["users"]): Promise<[string, UserData][]> {
      return Promise.resolve(Array.from(users));
    },
    password(value: string): Promise<string> {
      return Promise.resolve(hmac(value));
    },
  };

  static tokensUtils = {
    deserialize(
      rawTokens: [string, TokenData][]
    ): Promise<[string, TokenData][]> {
      return Promise.resolve(rawTokens);
    },
    serialize(tokens: Cache["tokens"]): Promise<[string, TokenData][]> {
      return Promise.resolve(Array.from(tokens));
    },
    generateToken(): Promise<string> {
      return Promise.resolve(generateToken());
    },
  };
}
