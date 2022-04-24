import { hmac } from "../../utils/crypto";
import { AdapterHandler } from "../adapter";

export const v1Signup: AdapterHandler = async (adapter) => {
  if (adapter.request.method !== "POST") {
    await adapter.response.sendBadRequest();
  } else {
    const data = await adapter.request.json<{
      username?: string;
      password?: string;
      email?: string;
    } | null>(null);

    if (!data || !data.username || !data.password || !data.email) {
      await adapter.response.sendBadRequest();
    } else {
      const username = data.username.toLocaleLowerCase();

      if (await adapter.storage.data.users.get(username)) {
        await adapter.response.sendBadRequest();
      } else {
        const userData = await adapter.storage.data.users.set(username, {
          password: hmac(data.password),
          email: data.email,
        });
        await adapter.storage.data.users.writeRecord(username, userData);
        await adapter.response.sendOk();
      }
    }
  }
};
