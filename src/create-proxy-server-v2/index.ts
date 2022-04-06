import { Server, createServer as createServerHttp } from "http";
import * as fs from "fs/promises";

import { colors } from "../utils/colors";
import { accessSoft, writeJson } from "../utils/fs";
import { RequestMeta } from "../utils/request-meta";
import {
  sendBadRequest,
  sendNotFound,
  sendOk,
  sendUnauthorized,
} from "../utils/responses";
import { ServerConfig } from "../utils/server-config";
import { proxyRequest } from "../utils/request";
import { changeHostPackageInfo, PackageInfo } from "../utils/package";
import { removeProps } from "../utils/object";
import { NpmCredentials } from "../utils/npm";
import { DataStorage } from "../utils/data-storage";

export function createProxyServer(params?: {
  serverConfig?: ServerConfig;
  dataStorage?: DataStorage;
}): Server {
  const { serverConfig, dataStorage } = params ?? {};

  return createServerHttp(async (req, res) => {
    const meta: RequestMeta = new RequestMeta({
      req,
      res,
      serverConfig,
      dataStorage,
    });

    console.log(
      colors.bgBlack.cyan(meta.method),
      meta.url.bgCyan,
      meta.command || "(no command)",
      "|",
      meta.api.version || "(no api)",
      "|",
      meta.api.path || "(no path)",
      "|",
      meta.tokenShort || "(no token)"
    );

    if (meta.command) {
      return await handleCommand(meta);
    }

    if (meta.api.version) {
      return await handleApi(meta);
    }

    return await sendNotFound(meta.res);
  });
}

async function handleCommand(meta: RequestMeta): Promise<void> {
  const handler = commandHandlers[meta.command];

  if (!handler) {
    return await sendNotFound(meta.res);
  }

  return await handler(meta);
}

const commandHandlers: Record<string, (meta: RequestMeta) => Promise<void>> = {
  install: handleInstallCommand,
  publish: handlePublishCommand,
  view: handleViewCommand,
  adduser: handleAdduserCommand,
  logout: handleLogoutCommand,
};

async function handleInstallCommand(meta: RequestMeta): Promise<void> {
  // audit
  if (meta.url.startsWith("/-")) {
    return await sendOk(meta.res);
  }

  if (meta.parsedUrl.ext) {
    return await handleGettingTarball(meta);
  }

  return await handleGettingInfo(meta);
}

async function handleGettingTarball(meta: RequestMeta): Promise<void> {
  // Check saved file already
  if (await accessSoft(meta.paths.tarball.file)) {
    return await sendOk(meta.res, {
      data: await fs.readFile(meta.paths.tarball.file),
    });
  }

  const proxyUrls = meta.serverConfig.getProxyUrls({
    name: meta.pkg.name,
    scope: meta.pkg.scope,
    command: meta.command,
  });
  const reqData = await meta.data;

  for (const proxyUrl of proxyUrls) {
    const request = proxyRequest(meta.req, proxyUrl)();
    const { res } = await request(reqData);

    if (res && RequestMeta.isResSuccessful(res)) {
      const dataProxy = await RequestMeta.getData(res);

      await fs.mkdir(meta.paths.tarball.dir, { recursive: true });
      await fs.writeFile(meta.paths.tarball.file, dataProxy);

      return await sendOk(meta.res, { data: dataProxy });
    }
  }

  return await sendNotFound(meta.res);
}

async function handleGettingInfo(meta: RequestMeta): Promise<void> {
  const proxyUrls = meta.serverConfig.getProxyUrls({
    name: meta.pkg.name,
    scope: meta.pkg.scope,
    command: meta.command,
  });
  const reqData = await meta.data;

  for (const proxyUrl of proxyUrls) {
    const request = proxyRequest(meta.req, proxyUrl)();
    const { res } = await request(reqData);

    if (res && RequestMeta.isResSuccessful(res)) {
      const dataProxy = await RequestMeta.getData(res);
      const json = RequestMeta.parseData<PackageInfo>(dataProxy);

      if (!json || json?.error) {
        return await sendNotFound(meta.res, { data: dataProxy });
      }

      const data = changeHostPackageInfo(json, meta.headers.host);

      await fs.mkdir(meta.paths.info.dir, { recursive: true });
      await writeJson(meta.paths.info.file, data, null, 2);

      return await sendOk(meta.res, { data: JSON.stringify(data) });
    }
  }

  // Check saved file already
  if (await accessSoft(meta.paths.info.file)) {
    return await sendOk(meta.res, {
      data: await fs.readFile(meta.paths.info.file),
    });
  }

  return await sendNotFound(meta.res);
}

async function handlePublishCommand(meta: RequestMeta): Promise<void> {
  if (!meta.token) {
    return await sendUnauthorized(meta.res);
  }

  const registryToken = await meta.dataStorage.registryTokens.get(meta.token);
  const proxyUrls = meta.serverConfig.getProxyUrls({
    name: meta.pkg.name,
    scope: meta.pkg.scope,
    command: meta.command,
  });
  const reqData = await meta.data;

  console.log(proxyUrls);

  for (const proxyUrl of proxyUrls) {
    const registryTokenValue =
      registryToken?.registries[new URL(proxyUrl).host];

    if (registryTokenValue) {
      console.log(registryTokenValue);

      const request = proxyRequest(
        meta.req,
        proxyUrl
      )((options) => ({
        ...options,
        headers: {
          ...options.headers,
          authorization: `Bearer ${registryTokenValue}`,
        },
      }));
      const { res } = await request(reqData);

      console.log(res?.statusCode);

      if (res && RequestMeta.isResSuccessful(res)) {
        return await sendOk(meta.res, { data: await RequestMeta.getData(res) });
      }
    }
  }

  return await sendBadRequest(meta.res);
}

async function handleViewCommand(meta: RequestMeta): Promise<void> {
  const proxyUrls = meta.serverConfig.getProxyUrls({
    name: meta.pkg.name,
    scope: meta.pkg.scope,
    command: meta.command,
  });
  const reqData = await meta.data;

  for (const proxyUrl of proxyUrls) {
    const request = proxyRequest(
      meta.req,
      proxyUrl
    )((options) => ({
      ...options,
      headers: removeProps(options.headers ?? {}, "accept-encoding"),
    }));
    const { res } = await request(reqData);

    if (res && RequestMeta.isResSuccessful(res)) {
      const dataProxy = await RequestMeta.getData(res);
      const json = RequestMeta.parseData<PackageInfo>(dataProxy);

      if (!json || json?.error) {
        return await sendNotFound(meta.res, { data: dataProxy });
      }

      const data = changeHostPackageInfo(json, meta.headers.host);

      await fs.mkdir(meta.paths.info.dir, { recursive: true });
      await writeJson(meta.paths.info.file, data, null, 2);

      return await sendOk(meta.res, { data: JSON.stringify(data) });
    }
  }

  // Check saved file already
  if (await accessSoft(meta.paths.info.file)) {
    return await sendOk(meta.res, {
      data: await fs.readFile(meta.paths.info.file),
    });
  }

  return await sendBadRequest(meta.res);
}

async function handleAdduserCommand(meta: RequestMeta): Promise<void> {
  const creds: Partial<NpmCredentials> = await meta.dataJson;

  if (!creds.name || !creds.password || !creds.email) {
    return await sendUnauthorized(meta.res);
  }

  const user = await meta.dataStorage.users.get(creds.name ?? "");

  if (!user) {
    return await sendUnauthorized(meta.res);
  }

  if (
    (await DataStorage.usersUtils.password(creds.password)) !== user.password
  ) {
    return await sendUnauthorized(meta.res);
  }

  const token = await meta.dataStorage.tokens.create({
    // type: "npm",
    username: creds.name,
  });

  return await sendOk(meta.res, { end: JSON.stringify({ token }) });
}

async function handleLogoutCommand(meta: RequestMeta): Promise<void> {
  if (!meta.token) {
    return await sendOk(meta.res);
  }

  if (!(await meta.dataStorage.tokens.has(meta.token))) {
    return await sendOk(meta.res);
  }

  await meta.dataStorage.tokens.delete(meta.token);
  await meta.dataStorage.registryTokens.delete(meta.token);

  return await sendOk(meta.res);
}

async function handleApi(meta: RequestMeta): Promise<void> {
  const handle = apiHandlers[meta.api.path];

  if (!handle) {
    return await sendBadRequest(meta.res);
  }

  return await handle(meta);
}

const apiHandlers: Record<string, (meta: RequestMeta) => Promise<void>> = {
  "/signup": handleSignup,
  "/token": handleToken,
};

async function handleSignup(meta: RequestMeta): Promise<void> {
  if (meta.method !== "POST") {
    return await sendBadRequest(meta.res);
  }

  const creds: Partial<{
    login: string;
    password: string;
    email: string;
  }> | null = await meta.dataJson;

  if (!creds || !creds.login || !creds.password || !creds.email) {
    return await sendBadRequest(meta.res);
  }

  const login = creds.login.toLocaleLowerCase();

  if (await meta.dataStorage.users.has(login)) {
    return await sendBadRequest(meta.res);
  }

  await meta.dataStorage.users.set(login, {
    password: await DataStorage.usersUtils.password(creds.password),
    email: creds.email,
  });

  return await sendOk(meta.res);
}

async function handleToken(meta: RequestMeta): Promise<void> {
  if (meta.method !== "POST") {
    return await sendBadRequest(meta.res);
  }

  if (!meta.token || !(await meta.dataStorage.tokens.has(meta.token))) {
    return await sendUnauthorized(meta.res);
  }

  const data = await meta.json<{ registry?: string; token?: string }>();

  if (!data || !data.registry || !data.token) {
    return await sendBadRequest(meta.res);
  }

  const registryToken = await meta.dataStorage.registryTokens.get(meta.token);

  await meta.dataStorage.registryTokens.set(meta.token, {
    ...registryToken,
    registries: {
      ...registryToken?.registries,
      [new URL(data.registry).host]: data.token,
    },
  });

  return await sendOk(meta.res);
}
