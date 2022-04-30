import { hmac } from "../../utils/crypto";
import { AdapterHandler } from "../adapter";
import { createPipe } from "../create-pipe";

type SignupData = {
  username?: string;
  password?: string;
  email?: string;
};

const getSignupData: AdapterHandler<SignupData | null> = async (adapter) => {
  return await adapter.request.json<SignupData | null>(null);
};

export const v1Signup = createPipe([
  async (adapter) => {
    const data = await getSignupData(adapter);

    if (!data || !data.username || !data.password || !data.email) {
      await adapter.response.sendBadRequest();
    }
  },
  async (adapter) => {
    const data = await getSignupData(adapter);
    const username = data?.username?.toLocaleLowerCase() ?? "";

    if (await adapter.storage.data.users.get(username)) {
      await adapter.response.sendBadRequest();
    }
  },
  async (adapter) => {
    const data: Required<SignupData> = {
      username: "",
      password: "",
      email: "",
      ...(await getSignupData(adapter)),
    };
    const username = data?.username?.toLocaleLowerCase() ?? "";
    const users = adapter.storage.data.users;
    const userData = await users.set(username, {
      password: hmac(data.password),
      email: data.email,
    });

    await users.writeRecord(username, userData);
    await adapter.response.sendOk();
  },
]);
