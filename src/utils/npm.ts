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

export type NpmResponse = {
  error?: string;
};

export type PackageDist = {
  shasum: string;
  tarball: string;
};

export type PackageVersion = {
  dist: PackageDist;
  _npmUser?: NpmUser;
};

export type NpmUser = {
  name: string;
  email: string;
};

export type NpmPackageInfo = {
  name: string;
  versions: Record<string, PackageVersion>;
};

export type NpmPackageInfoView = NpmResponse & NpmPackageInfo;

export type NpmPackageInfoInstall = NpmResponse & NpmPackageInfo;

export type NpmPackageInfoPublish = NpmResponse &
  NpmPackageInfo & {
    _attachments: Record<string, NpmPackageAttachment>;
  };

export type NpmPackageAttachment = {
  data: string;
};

export type NpmPackageInfoFull =
  | NpmPackageInfo
  | NpmPackageInfoInstall
  | NpmPackageInfoView
  | NpmPackageInfoPublish;

export type RegistryConfig = Record<string, string> & {
  _authToken?: string;
};

export async function getRegistryConfig(
  registryUrl: string | URL,
  configFiles?: string[]
): Promise<RegistryConfig> {
  const { host, pathname } =
    registryUrl instanceof URL ? registryUrl : new URL(registryUrl);
  const files = configFiles ?? [
    path.join(process.cwd(), ".npmrc"),
    await getNpmConfigValue("userconfig"),
    await getNpmConfigValue("globalconfig"),
  ];
  const data = await Promise.all(files.reverse().map(readFileSoft));
  const lines = Buffer.concat(data).toString().trim().split("\n");
  const entries = lines
    .map((line) => line.match(getRegistryRegExp(host + pathname)) ?? [])
    .filter((item) => item.length)
    .map(([, key, value]) => [key, value]);

  return Object.fromEntries(entries);
}

export async function getNpmConfigValue(
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
  return new RegExp(`^//${host.replace(/\/+$/, "")}/:([\\w\\d_-]*)=(.*)`);
}
