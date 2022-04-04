import { Server, createServer as createServerHttp } from "http";
import * as fs from "fs/promises";
import * as path from "path";
import * as merge from "merge";

import { colors } from "../utils/colors";
import { accessSoft, readJson } from "../utils/fs";
import { RequestMeta } from "../utils/request-meta";
import {
  sendBadRequest,
  sendNotFound,
  sendOk,
  sendUnauthorized,
} from "../utils/responses";
import { ServerConfig } from "../utils/server-config";
import { PackageInfo } from "../utils/package";
import { removeProps } from "../utils/object";
import { DataStorage } from "../utils/data-storage";
import { NpmCredentials } from "../utils/npm";

export function createRegistryServer(params: {
  serverConfig: ServerConfig;
  dataStorage: DataStorage;
}): Server {
  const { serverConfig, dataStorage } = params;

  return createServerHttp(async (req, res) => {
    const meta: RequestMeta = new RequestMeta({
      req,
      res,
      serverConfig,
      dataStorage,
    });

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
  console.log(
    colors.bgCyan.black(meta.headers.npmSession),
    colors.bgBlack.cyan(meta.method),
    colors.cyan.bold(meta.command),
    meta.url
  );

  if (meta.token) {
    console.log(
      colors.bgCyan.black(meta.headers.npmSession),
      colors.green(meta.tokenShort)
    );
  }

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
  whoami: handleWhoamiCommand,
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
  if (!(await accessSoft(meta.paths.tarball.file))) {
    return await sendNotFound(meta.res);
  }

  return await sendOk(meta.res, {
    data: await fs.readFile(meta.paths.tarball.file),
  });
}

async function handleGettingInfo(meta: RequestMeta): Promise<void> {
  if (!(await accessSoft(meta.paths.info.file))) {
    return await sendNotFound(meta.res);
  }

  return await sendOk(meta.res, {
    data: await fs.readFile(meta.paths.info.file),
  });
}

async function handlePublishCommand(meta: RequestMeta): Promise<void> {
  const pkgInfo: PackageInfo = await meta.dataJson;
  const attachments = Object.entries(pkgInfo._attachments);

  await fs.mkdir(meta.paths.tarball.dir, { recursive: true });

  for (const [fileName, { data }] of attachments) {
    const file = path.join(meta.paths.tarball.dir, fileName);

    if (await accessSoft(file)) {
      return await sendBadRequest(meta.res);
    }

    await fs.writeFile(file, data, "base64");
  }

  const currInfo = await readJson<PackageInfo>(meta.paths.info.file);
  const nextInfo: PackageInfo = merge.recursive(
    currInfo ?? {},
    removeProps(pkgInfo, "_attachments")
  );

  await fs.writeFile(meta.paths.info.file, JSON.stringify(nextInfo, null, 2));

  return await sendOk(meta.res);
}

async function handleViewCommand(meta: RequestMeta): Promise<void> {
  if (!(await accessSoft(meta.paths.info.file))) {
    return await sendNotFound(meta.res);
  }

  return await sendOk(meta.res, {
    data: await fs.readFile(meta.paths.info.file),
  });
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

  const token = await meta.dataStorage.tokens.create({ username: creds.name });

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

  return await sendOk(meta.res);
}

async function handleWhoamiCommand(meta: RequestMeta): Promise<void> {
  const tokenData = await meta.dataStorage.tokens.get(meta.token);

  if (!tokenData) {
    return await sendUnauthorized(meta.res);
  }

  return await sendOk(meta.res, {
    end: JSON.stringify({ username: tokenData.username }),
  });
}

async function handleApi(meta: RequestMeta): Promise<void> {
  console.log(
    colors.bgBlack.cyan(meta.method),
    colors.cyan.bold(meta.api.version),
    colors.cyan.bold(meta.api.path)
  );

  const handle = apiHandlers[meta.api.path];

  if (!handle) {
    return await sendBadRequest(meta.res);
  }

  return await handle(meta);
}

const apiHandlers: Record<string, (meta: RequestMeta) => Promise<void>> = {
  "/signup": handleSignup,
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
