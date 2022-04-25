import * as fs from "fs/promises";
import { generateToken } from "../../utils/crypto";

import { accessSoft, readFileSoft } from "../../utils/fs";
import { NpmCredentials, NpmPackageInfoInstall } from "../../utils/npm";
import { removeProps } from "../../utils/object";
import { RequestOptionsFormatter } from "../../utils/request";
import { createPipe } from "../create-pipe";

export const install = createPipe([
  async (adapter) => {
    if (adapter.url?.startsWith("/-")) await adapter.response.sendOk();
  },
  async (adapter) => {
    if (adapter.urlPath.ext) await getTarball(adapter);
  },
  async (adapter) => {
    await getInfo(adapter);
  },
]);

const getTarball = createPipe([
  async (adapter) => {
    if (await accessSoft(adapter.tarballFile)) {
      const end = await readFileSoft(adapter.tarballFile);
      await adapter.response.sendOk({ end });
    }
  },
  async (adapter) => {
    for (const targetUrl of adapter.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const authorization = await adapter.getSessionAuthorization(targetUrl);
      const formatter: RequestOptionsFormatter = (options) => ({
        ...options,
        headers: { ...options.headers, authorization },
      });
      const { res } = await adapter.proxyRequest(targetUrl, formatter);

      if (res && res.isSuccess) {
        const data = await res.data();

        await fs.mkdir(adapter.tarballDir, { recursive: true });
        await fs.writeFile(adapter.tarballFile, data, "base64");
        await adapter.response.sendOk({ end: data });
      }
    }
  },
]);

const getInfo = createPipe([
  async (adapter) => {
    for (const targetUrl of adapter.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const authorization = await adapter.getSessionAuthorization(targetUrl);
      const formatter: RequestOptionsFormatter = (options) => ({
        ...options,
        headers: {
          ...removeProps(options.headers ?? {}, "accept", "accept-encoding"),
          authorization,
        },
      });
      const { res } = await adapter.proxyRequest(targetUrl, formatter);

      if (res && res.isSuccess) {
        const info = await res.json<NpmPackageInfoInstall | null>(null);

        if (info && !info.error) {
          const data = await adapter.hooks.formatterPackageInfo(info, adapter);
          const dataJson = JSON.stringify(data, null, 2);

          await fs.mkdir(adapter.infoDir, { recursive: true });
          await fs.writeFile(adapter.infoFile, dataJson);
          await adapter.response.sendOk({ end: dataJson });
          break;
        }
      }
    }
  },
  async (adapter) => {
    if (await accessSoft(adapter.infoFile)) {
      await adapter.response.sendOk({
        end: await readFileSoft(adapter.infoFile),
      });
    }
  },
  async (adapter) => {
    await adapter.response.sendNotFound();
  },
]);

export const view = getInfo;

export const adduser = createPipe([
  async (adapter) => {
    const data = await adapter.request.json<NpmCredentials>({
      name: "",
      password: "",
      email: "",
    });
    const token = generateToken();

    const tokenData = await adapter.storage.data.tokens.set(token, {
      username: data.name,
    });
    await adapter.storage.data.tokens.writeRecord(token, tokenData);
    await adapter.response.sendOk({ end: JSON.stringify({ token }) });
  },
]);

export const logout = createPipe([
  async (adapter) => {
    const token = adapter.request.token;

    await adapter.storage.data.tokens.remove(token);
    await adapter.storage.data.sessions.remove(token);
    await adapter.response.sendOk();
  },
]);

export const whoami = createPipe([
  async (adapter) => {
    const token = adapter.request.token;
    const tokenData = await adapter.storage.data.tokens.get(token);

    if (!tokenData) {
      await adapter.response.sendUnauthorized();
    }
  },
  async (adapter) => {
    const token = adapter.request.token;
    const tokenData = await adapter.storage.data.tokens.get(token);
    await adapter.response.sendOk({
      end: JSON.stringify({ username: tokenData?.username }),
    });
  },
]);

export const publish = createPipe([
  async (adapter) => {
    for (const targetUrl of adapter.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const authorization = await adapter.getSessionAuthorization(targetUrl);
      const formatter: RequestOptionsFormatter = (options) => ({
        ...options,
        headers: {
          ...removeProps(options.headers ?? {}, "accept", "accept-encoding"),
          authorization,
        },
      });
      const { res } = await adapter.proxyRequest(targetUrl, formatter);

      if (res && res.isSuccess) {
        await adapter.response.sendOk({ end: await res.data() });
        return;
      }
    }
  },
  async (adapter) => {
    await adapter.response.sendBadRequest();
  },
]);
