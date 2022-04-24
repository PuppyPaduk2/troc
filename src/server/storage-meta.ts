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

type StorageParams = {
  storageDir: string;
};

export class StorageMeta {
  private storageDir: string;
  public data: Data;

  constructor(params: StorageParams) {
    this.storageDir = params.storageDir;
    this.data = {
      users: this.getJsonCache("users.json"),
      tokens: this.getJsonCache("tokens.json"),
      sessions: this.getJsonCache("sessions.json"),
    };
  }

  public get registryDir(): string {
    return path.join(this.storageDir, "registry");
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
