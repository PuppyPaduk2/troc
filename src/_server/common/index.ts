import { hmac } from "../../utils/crypto";
import { NpmCredentials } from "../../utils/npm";
import { AdapterHandler } from "../adapter";

export const checkMethod =
  (methods: string[]): AdapterHandler =>
  async (adapter) => {
    if (!methods.includes(adapter.request.method ?? "")) {
      await adapter.response.sendBadRequest();
    }
  };

export const checkCredentials: AdapterHandler = async (adapter) => {
  const data = await adapter.request.json<NpmCredentials | null>(null);

  if (!data || !data.name || !data.password) {
    await adapter.response.sendUnauthorized();
  } else {
    const user = await adapter.storage.data.users.get(data.name);

    if (!user || hmac(data.password) !== user.password) {
      await adapter.response.sendUnauthorized();
    }
  }
};

export const checkToken =
  (response?: () => Promise<void>): AdapterHandler =>
  async (adapter) => {
    if (
      !adapter.request.token ||
      !(await adapter.storage.data.tokens.get(adapter.request.token))
    ) {
      if (response) {
        await response();
      } else {
        await adapter.response.sendUnauthorized();
      }
    }
  };

export const log: AdapterHandler = async (adapter) => {
  console.log(
    ">",
    adapter.request.method?.padEnd(4),
    adapter.request.url,
    adapter.request.command
  );
};
