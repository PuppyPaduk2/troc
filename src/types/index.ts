import { JsonCache } from "../utils/v2/json-cache";
import { NpmRequestHandler } from "../utils/v2/npm-server";

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
