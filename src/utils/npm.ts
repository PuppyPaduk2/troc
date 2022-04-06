import * as path from "path";
import { spawn } from "./cp";

import { readFileSoft } from "./fs";

export type NpmTokenResponse = {
  ok: boolean;
  id: string;
  rev: string;
  token: string;
};

export type NpmCredentials = {
  name: string;
  password: string;
  email: string;
};

export type RegistryConfig = Record<string, string> & {
  _authToken?: string;
};

export async function getRegistryConfig(
  registryUrl: string | URL,
  configFiles?: string[]
): Promise<RegistryConfig> {
  const { host } =
    registryUrl instanceof URL ? registryUrl : new URL(registryUrl);
  const files = configFiles ?? [
    path.join(process.cwd(), ".npmrc"),
    await getConfigValue("userconfig"),
    await getConfigValue("globalconfig"),
  ];
  const data = await Promise.all(files.reverse().map(readFileSoft));
  const lines = Buffer.concat(data).toString().trim().split("\n");
  const entries = lines
    .map((line) => line.match(getRegistryRegExp(host)) ?? [])
    .filter((item) => item.length)
    .map(([, key, value]) => [key, value]);

  return Object.fromEntries(entries);
}

export async function getConfigValue(
  key: string,
  cwd: string = process.cwd()
): Promise<string> {
  return spawn("npm", ["config", "get", key], { cwd }).then(
    ({ closeCode, stdoutData }) => {
      if (closeCode !== 0) {
        return "";
      }

      return Buffer.concat(stdoutData).toString().trim();
    }
  );
}

function getRegistryRegExp(host: string): RegExp {
  return new RegExp(`^//${host}/:([\\w_-]*)=(.*)`);
}
