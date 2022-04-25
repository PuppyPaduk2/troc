import * as path from "path";

import { JsonCache } from "./json-cache";

type User = {
  password: string;
  email: string;
};

type Tokens = {
  username: string;
};

type Sessions = {
  registries: Record<string, string>;
};

export type Data = {
  users: JsonCache<User>;
  tokens: JsonCache<Tokens>;
  sessions: JsonCache<Sessions>;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type Registry = {};

export type Registries = Record<string, Registry>;

type StorageParams = {
  storageDir: string;
  registries: Registries;
};

export class StorageMeta {
  private storageDir: string;
  private registries: Registries;
  public data: Data;

  constructor(params: StorageParams) {
    this.storageDir = params.storageDir;
    this.registries = params.registries;
    this.data = {
      users: this.getJsonCache("users.json"),
      tokens: this.getJsonCache("tokens.json"),
      sessions: this.getJsonCache("sessions.json"),
    };
  }

  public get registryDir(): string {
    return path.join(this.storageDir, "registry");
  }

  public get registryPaths(): string[] {
    return Object.keys(this.registries);
  }

  public async readData(): Promise<void> {
    await Promise.allSettled([
      this.data.users.readAll(),
      this.data.tokens.readAll(),
      this.data.sessions.readAll(),
    ]);
  }

  private getJsonCache<S extends object>(fileName: string): JsonCache<S> {
    return new JsonCache<S>(path.join(this.storageDir, fileName));
  }
}
