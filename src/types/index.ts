import { JsonCache } from "../utils/json-cache";
import { NpmRequestHandler } from "../utils/npm-server";

type User = {
  password: string;
  email: string;
};

export type TrocServerData = {
  users: JsonCache<User>;
  tokens: JsonCache<{
    username: string;
  }>;
  sessions: JsonCache<{
    registries: Record<string, string>;
  }>;
};

export type TrocRequestHandler = NpmRequestHandler<TrocServerData>;
