import { hmac } from "../../utils/crypto";
import { AdapterNext } from "../adapter-next";
import { AdapterHandler } from "./types";

export const signup: AdapterHandler = async (adapter) => {
  if (!adapter.registry) return await adapter.response.sendBadRequest();

  const data = await getSignupData(adapter);
  const signupData = await validSignupData(data);
  if (!signupData) return await adapter.response.sendBadRequest();

  const name = signupData.name.toLocaleLowerCase();
  const userData = await adapter.registry.cache.getUser(name);
  if (userData) return await adapter.response.sendBadRequest();

  const password = hmac(signupData.password);
  const email = signupData.email;
  await adapter.registry.cache.setUser(name, { password, email });
  await adapter.response.sendOk();
};

type SignupData = {
  name: string;
  password: string;
  email: string;
};

const getSignupData = async (
  adapter: AdapterNext
): Promise<Partial<SignupData> | null> => {
  return await adapter.request.data.json<Partial<SignupData> | null>(null);
};

const validSignupData = async (
  data: Partial<SignupData> | null
): Promise<SignupData | null> => {
  if (!data || !data.name || !data.password || !data.email) return null;
  return { name: "", password: "", email: "", ...data };
};

export const attachToken: AdapterHandler = async (adapter) => {
  if (!adapter.registry || !adapter.token)
    return await adapter.response.sendBadRequest();

  if (!(await adapter.isCorrectToken()))
    return await adapter.response.sendUnauthorized();

  const data = await getAttachTokenData(adapter);
  const attachTokenData = await validAttachTokenData(data);
  if (!attachTokenData) return await adapter.response.sendBadRequest();

  await adapter.registry.cache.addSessionRegistry(
    adapter.token,
    attachTokenData.registryUrl,
    attachTokenData.token
  );
  await adapter.response.sendOk();
};

type AttachTokenData = {
  registryUrl: string;
  token: string;
};

const getAttachTokenData = async (
  adapter: AdapterNext
): Promise<Partial<AttachTokenData> | null> => {
  return await adapter.request.data.json<Partial<AttachTokenData> | null>(null);
};

const validAttachTokenData = async (
  data: Partial<AttachTokenData> | null
): Promise<AttachTokenData | null> => {
  if (!data || !data.registryUrl || !data.token) return null;
  return { registryUrl: "", token: "", ...data };
};
