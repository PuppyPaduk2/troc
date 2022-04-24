import { AdapterHandler } from "../adapter";
import { createPipe } from "../create-pipe";

type AttachTokenData = {
  registryUrl: string;
  token: string;
};

const getAttachTokenData: AdapterHandler<AttachTokenData | null> = async (
  adapter
) => {
  return await adapter.request.json<AttachTokenData | null>(null);
};

export const v1AttachToken = createPipe([
  async (adapter) => {
    const data = await getAttachTokenData(adapter);

    if (!data) {
      await adapter.response.sendBadRequest();
    }
  },
  async (adapter) => {
    const data = (await getAttachTokenData(adapter)) ?? {
      registryUrl: "",
      token: "",
    };
    const token = adapter.request.token;
    const sessions = adapter.storage.data.sessions;
    const session = (await sessions.get(token)) ?? { registries: {} };
    const registries = {
      ...session.registries,
      [data.registryUrl]: data.token,
    };

    const newSession = await sessions.set(token, { ...session, registries });
    await sessions.writeRecord(token, newSession);
    await adapter.response.sendOk();
  },
]);
