import { generateToken } from "../../../../utils/crypto";
import { NpmCredentials } from "../../../../utils/npm";
import { Bus } from "../../bus";

export const bothAuth = Bus.pipe([
  async (bus) => {
    if (bus.npmCommand === "adduser") await adduser(bus);
  },
]);

const adduser = Bus.pipe([
  async (bus) => {
    const data = await bus.json<Partial<NpmCredentials> | null>({
      name: "",
      password: "",
      email: "",
    });

    if (!data || !data.name || !data.password || !data.email) {
      await bus.sendUnauthorized();
    }
  },
  async (bus) => {
    const data = await bus.json<NpmCredentials>({
      name: "",
      password: "",
      email: "",
    });
    const token = generateToken();
    await bus.registry?.setToken(token, { username: data.name });
    await bus.sendOk({ end: JSON.stringify({ token }) });
  },
]);
