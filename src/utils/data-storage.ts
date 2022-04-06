import { generateToken, hmac } from "./crypto";

export type Token = string;

export type Cache = {
  users: Map<string, UserData>;
  tokens: Map<Token, TokenData>;
  registryTokens: Map<Token, RegistryTokenData>;
};

export type UserData = {
  password: string;
  email: string;
};

export type TokenData = {
  // type: "npm" | "troc";
  username: string;
};

export type RegistryTokenData = {
  registries: Record<string, Token>;
};

export type Handlers = {
  onChange: <Name extends keyof Cache>(
    name: Name,
    type: "set" | "create" | "delete" | "change"
  ) => Promise<void>;
};

export class DataStorage {
  public cache: Cache;
  public handlers: Handlers;

  constructor(
    params?: {
      users?: [string, UserData][];
      tokens?: [Token, TokenData][];
      registryTokens?: [Token, RegistryTokenData][];
    },
    handlers?: Partial<Handlers>
  ) {
    this.cache = {
      users: new Map(params?.users ?? []),
      tokens: new Map(params?.tokens ?? []),
      registryTokens: new Map(params?.registryTokens ?? []),
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
      set: async (token: Token, tokenData: TokenData): Promise<void> => {
        this.cache.tokens.set(token, tokenData);
        await this.handlers.onChange("tokens", "set");
      },
      create: async (tokenData: TokenData): Promise<Token> => {
        const token = generateToken();
        this.cache.tokens.set(token, tokenData);
        await this.handlers.onChange("tokens", "create");
        return token;
      },
      get: async (token: Token): Promise<TokenData | null> => {
        return this.cache.tokens.get(token) ?? null;
      },
      has: async (token: Token): Promise<boolean> => {
        return this.cache.tokens.has(token);
      },
      delete: async (token: Token): Promise<boolean> => {
        const result = this.cache.tokens.delete(token);

        if (!result) {
          return result;
        }

        await this.handlers.onChange("tokens", "delete");
        return result;
      },
      serialize: async (): Promise<[Token, TokenData][]> => {
        return await DataStorage.tokensUtils.serialize(this.cache.tokens);
      },
    };
  }

  public get registryTokens() {
    return {
      set: async (token: Token, data: RegistryTokenData): Promise<void> => {
        this.cache.registryTokens.set(token, data);
        await this.handlers.onChange("registryTokens", "set");
      },
      get: async (token: Token): Promise<RegistryTokenData | null> => {
        return this.cache.registryTokens.get(token) ?? null;
      },
      delete: async (token: Token): Promise<boolean> => {
        const result = this.cache.registryTokens.delete(token);

        if (!result) {
          return result;
        }

        await this.handlers.onChange("registryTokens", "delete");
        return result;
      },
      serialize: async (): Promise<[Token, RegistryTokenData][]> => {
        return await DataStorage.registryTokensUtils.serialize(
          this.cache.registryTokens
        );
      },
    };
  }

  static usersUtils = {
    deserialize(data: [string, UserData][]): Promise<[string, UserData][]> {
      return Promise.resolve(data);
    },
    serialize(data: Cache["users"]): Promise<[string, UserData][]> {
      return Promise.resolve(Array.from(data));
    },
    password(value: string): Promise<string> {
      return Promise.resolve(hmac(value));
    },
  };

  static tokensUtils = {
    deserialize(data: [string, TokenData][]): Promise<[string, TokenData][]> {
      return Promise.resolve(data);
    },
    serialize(data: Cache["tokens"]): Promise<[string, TokenData][]> {
      return Promise.resolve(Array.from(data));
    },
    generateToken(): Promise<string> {
      return Promise.resolve(generateToken());
    },
  };

  static registryTokensUtils = {
    deserialize(
      data: [Token, RegistryTokenData][]
    ): Promise<[Token, RegistryTokenData][]> {
      return Promise.resolve(data);
    },
    serialize(
      data: Cache["registryTokens"]
    ): Promise<[Token, RegistryTokenData][]> {
      return Promise.resolve(Array.from(data));
    },
  };
}
