import { hmac } from "../../../../utils/crypto";
import { Bus } from "../../bus";

export const withoutAuth = Bus.pipe([
  async (bus) => {
    if (bus.apiVersion === "/v1") {
      if (bus.apiPath === "/signup") await signupV1(bus);
    }
    await bus.sendBadRequest();
  },
]);

type SignupData = {
  name: string;
  password: string;
  email: string;
};

const defSignupData: SignupData = Object.freeze({
  name: "",
  password: "",
  email: "",
});

const signupV1 = Bus.pipe([
  async (bus) => {
    const data = await bus.json<Partial<SignupData>>(defSignupData);

    if (!data || !data.name || !data.password || !data.email) {
      await bus.sendBadRequest();
    }
  },
  async (bus) => {
    const data = await bus.json<SignupData>(defSignupData);
    const name = data.name.toLocaleLowerCase();

    if (await bus.registry?.getUser(name)) {
      await bus.sendBadRequest();
    }
  },
  async (bus) => {
    const data = await bus.json<SignupData>(defSignupData);
    const name = data.name.toLocaleLowerCase();
    await bus.registry?.setUser(name, {
      password: hmac(data.password),
      email: data.email,
    });
    await bus.sendOk();
  },
]);
