import { hmac } from "../../utils/crypto";
import { Adapter } from "../adapter";

export const v1Signup = async (adapter: Adapter): Promise<void> => {
  const data = await getSignupData(adapter);
  const signupData = await validSignupData(data);
  if (!signupData) return await adapter.res.sendBadRequest();
  const name = signupData.name.toLocaleLowerCase();
  const password = hmac(signupData.password);
  const email = signupData.email;
  await adapter.registry?.setUser(name, { password, email });
};

type SignupData = {
  name: string;
  password: string;
  email: string;
};

const getSignupData = async (
  adapter: Adapter
): Promise<Partial<SignupData> | null> => {
  return await adapter.req.json<Partial<SignupData> | null>(null);
};

const validSignupData = async (
  data: Partial<SignupData> | null
): Promise<SignupData | null> => {
  if (!data || !data.name || !data.password || !data.email) return null;
  return { name: "", password: "", email: "", ...data };
};

export const v1AttachToken = async (adapter: Adapter): Promise<void> => {
  if (!(await adapter.isCorrectToken)) await adapter.res.sendUnauthorized();
  const data = await getAttachTokenData(adapter);
  const attachTokenData = await validAttachTokenData(data);
  if (!attachTokenData) return await adapter.res.sendBadRequest();
  await adapter.registry?.addSessionRegistry(
    adapter.req.token,
    attachTokenData.registryUrl,
    attachTokenData.token
  );
  await adapter.res.sendOk();
};

type AttachTokenData = {
  registryUrl: string;
  token: string;
};

const getAttachTokenData = async (
  adapter: Adapter
): Promise<Partial<AttachTokenData> | null> => {
  return await adapter.req.json<Partial<AttachTokenData> | null>(null);
};

const validAttachTokenData = async (
  data: Partial<AttachTokenData> | null
): Promise<AttachTokenData | null> => {
  if (!data || !data.registryUrl || !data.token) return null;
  return { registryUrl: "", token: "", ...data };
};
