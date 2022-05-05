import * as fs from "fs/promises";
import * as path from "path";
import * as merge from "merge";

import { generateToken } from "../../utils/crypto";
import { accessSoft, readFileSoft, readJson } from "../../utils/fs";
import {
  NpmCredentials,
  NpmPackageAttachment,
  NpmPackageInfo,
  NpmPackageInfoInstall,
  NpmPackageInfoPublish,
} from "../../utils/npm";
import { Adapter } from "../adapter";
import { UserData } from "../registry";
import { Request } from "../request";
import { removeProps } from "../../utils/object";

export const adduser = async (adapter: Adapter): Promise<void> => {
  const data = await getNpmCredentials(adapter);
  const npmCredentials = await validNpmCredentials(data);
  if (!npmCredentials) return await adapter.res.sendUnauthorized();
  const token = generateToken();
  await adapter.registry?.setToken(token, { username: npmCredentials.name });
  await adapter.res.sendOk({ end: JSON.stringify({ token }) });
};

const getNpmCredentials = async (
  adapter: Adapter
): Promise<Partial<NpmCredentials> | null> => {
  return await adapter.req.json<Partial<NpmCredentials> | null>(null);
};

const validNpmCredentials = async (
  data: Partial<NpmCredentials> | null
): Promise<NpmCredentials | null> => {
  if (!data || !data.name || !data.password || !data.email) return null;
  return { name: "", password: "", email: "", ...data };
};

export const whoami = async (adapter: Adapter): Promise<void> => {
  const tokenData = await adapter.tokenData;
  if (!tokenData) return await adapter.res.sendUnauthorized();
  const end = JSON.stringify({ username: tokenData.username });
  await adapter.res.sendOk({ end });
};

export const logout = async (adapter: Adapter): Promise<void> => {
  if (adapter.req.token) await removeTokenAll(adapter);
  await adapter.res.sendOk();
};

const removeTokenAll = async (adapter: Adapter): Promise<void> => {
  await adapter.registry?.removeToken(adapter.req.token);
  await adapter.registry?.removeSession(adapter.req.token);
};

export const install = async (adapter: Adapter): Promise<void> => {
  if (adapter.req.url.href.startsWith("/-")) await adapter.res.sendOk();
  else if (adapter.registry?.isProxy) await installProxy(adapter);
  else await installLocal(adapter);
};

const installProxy = async (adapter: Adapter): Promise<void> => {
  if (adapter.req.path.ext) await installProxyTarball(adapter);
  else await installProxyInfo(adapter);
};

const installProxyTarball = async (adapter: Adapter): Promise<void> => {
  if (await accessSoft(adapter.tarballFile))
    return await installProxyTarballRead(adapter);
  for (const targetUrl of adapter.proxyUrls) {
    console.log("          -", targetUrl);
    const { res } = await adapter.proxyRequest(targetUrl);
    if (res?.isSuccess) return await installProxyTarballSave(adapter, res);
  }
};

const installProxyTarballRead = async (adapter: Adapter): Promise<void> => {
  const end = await readFileSoft(adapter.tarballFile);
  await adapter.res.sendOk({ end });
};

const installProxyTarballSave = async (
  adapter: Adapter,
  res: Request
): Promise<void> => {
  const data = await res.data();
  await fs.mkdir(adapter.tarballDir, { recursive: true });
  await fs.writeFile(adapter.tarballFile, data, "base64");
  await adapter.res.sendOk({ end: data });
};

const installProxyInfo = async (adapter: Adapter): Promise<void> => {
  for (const targetUrl of adapter.proxyUrls) {
    console.log("          -", targetUrl);
    const { res } = await adapter.proxyRequest(targetUrl);
    const info = (await res?.json<NpmPackageInfoInstall | null>(null)) ?? null;
    if (info && !info.error) return await installProxyInfoSave(adapter, info);
  }
  if (await accessSoft(adapter.infoFile)) await installProxyInfoRead(adapter);
};

const installProxyInfoSave = async (
  adapter: Adapter,
  info: NpmPackageInfoInstall
) => {
  const data = await adapter.hooks.formatPackageInfo(info);
  const dataJson = JSON.stringify(data, null, 2);
  await fs.mkdir(adapter.infoDir, { recursive: true });
  await fs.writeFile(adapter.infoFile, dataJson);
  await adapter.res.sendOk({ end: dataJson });
};

const installProxyInfoRead = async (adapter: Adapter): Promise<void> => {
  const end = await readFileSoft(adapter.infoFile);
  await adapter.res.sendOk({ end });
};

const installLocal = async (adapter: Adapter): Promise<void> => {
  if (adapter.req.path.ext) await installLocalTarball(adapter);
  else await installLocalInfo(adapter);
};

const installLocalTarball = async (adapter: Adapter): Promise<void> => {
  if (await accessSoft(adapter.tarballFile))
    await installLocalTarballRead(adapter);
  else await adapter.res.sendNotFound();
};

const installLocalTarballRead = async (adapter: Adapter): Promise<void> => {
  const end = await readFileSoft(adapter.tarballFile);
  await adapter.res.sendOk({ end });
};

const installLocalInfo = async (adapter: Adapter): Promise<void> => {
  if (await accessSoft(adapter.infoFile)) await installLocalInfoRead(adapter);
  else await adapter.res.sendNotFound();
};

const installLocalInfoRead = async (adapter: Adapter): Promise<void> => {
  const end = await readFileSoft(adapter.infoFile);
  await adapter.res.sendOk({ end });
};

export const view = async (adapter: Adapter): Promise<void> => {
  if (adapter.registry?.isProxy) await viewProxy(adapter);
  else await viewLocal(adapter);
};

const viewProxy = async (adapter: Adapter): Promise<void> => {
  return await installProxyInfo(adapter);
};

const viewLocal = async (adapter: Adapter): Promise<void> => {
  return await installLocalInfo(adapter);
};

export const publish = async (adapter: Adapter): Promise<void> => {
  if (adapter.registry?.isProxy) await publishProxy(adapter);
  else await publishLocal(adapter);
};

const publishProxy = async (adapter: Adapter): Promise<void> => {
  for (const targetUrl of adapter.proxyUrls) {
    console.log("          -", targetUrl);
    const { res } = await adapter.proxyRequest(targetUrl);
    if (res?.isSuccess)
      return await adapter.res.sendOk({ end: await res.data() });
  }
  await adapter.res.sendBadRequest();
};

const publishLocal = async (adapter: Adapter): Promise<void> => {
  const pkgInfo = await getPkgInfo(adapter);
  await fs.mkdir(adapter.tarballDir, { recursive: true });
  const attachments = Object.entries(pkgInfo._attachments);
  for (const [fileName, attachment] of attachments) {
    const isSaved = await savePkgAttachment(adapter, fileName, attachment);
    if (!isSaved) return await adapter.res.sendBadRequest();
  }
  const tokenData = await adapter.tokenData;
  const userData = await adapter.userData;
  if (tokenData && userData)
    await addNpmUser(pkgInfo, tokenData.username, userData);
  const currPkgInfo = await readPkgInfo(adapter);
  const nextPkgInfo = merge.recursive(
    currPkgInfo,
    removeProps(pkgInfo, "_attachments")
  );
  await fs.writeFile(adapter.infoFile, JSON.stringify(nextPkgInfo, null, 2));
  await adapter.res.sendOk();
};

const getPkgInfo = async (adapter: Adapter): Promise<NpmPackageInfoPublish> => {
  return await adapter.req.json<NpmPackageInfoPublish>({
    versions: {},
    _attachments: {},
  });
};

const savePkgAttachment = async (
  adapter: Adapter,
  fileName: string,
  attachment: NpmPackageAttachment
): Promise<boolean> => {
  const file = path.join(adapter.tarballDir, fileName);
  if (await accessSoft(file)) return false;
  await fs.writeFile(file, attachment.data, "base64");
  return true;
};

const addNpmUser = async (
  pkgInfo: NpmPackageInfo,
  name: string,
  { email }: UserData
): Promise<void> => {
  for (const [, version] of Object.entries(pkgInfo.versions)) {
    version._npmUser = { name, email };
  }
};

const readPkgInfo = async (adapter: Adapter): Promise<NpmPackageInfo> => {
  return (await readJson<NpmPackageInfo>(adapter.infoFile)) ?? { versions: {} };
};
