import { Server, createServer as createServerHttp } from "http";
import * as fs from "fs/promises";
import * as path from "path";
import * as merge from "merge";

import { colors } from "../utils/colors";
import { Meta } from "./meta";
import { getIncomingMessageData, proxyRequest } from "../utils/request";
import { changeHostPackageInfo, PackageInfo } from "../utils/package";
import { accessSoft, readJson } from "../utils/fs";
import { Config, ServerConfig, ServerEnvs } from "./config";
import { removeProps } from "../utils/object";
import { sendBadRequest, sendNotFound, sendOk, sendOkEmpty } from "./responses";

export async function createServer(
  config: Partial<ServerConfig> = {},
  envs: Partial<ServerEnvs> = {}
): Promise<Server> {
  const serverConfig = new Config(config, envs);

  await serverConfig.checkProxyUrls();

  const server = createServerHttp(async (req, res) => {
    const meta: Meta = new Meta({ req, res, serverConfig });

    if (meta.command) {
      return await processCommand(meta);
    }

    return await sendNotFound(meta.res);
  });

  return server;
}

async function processCommand(meta: Meta): Promise<void> {
  const { res, command } = meta;

  console.log(
    colors.bgBlack.cyan(meta.method),
    colors.bgCyan.black(meta.npmSession),
    colors.cyan.bold(command),
    meta.url
  );

  if (command === "install") {
    return await processCommandInstall(meta);
  } else if (command === "publish") {
    return await processPublishCommand(meta);
  } else if (command === "view") {
    return await processViewCommand(meta);
  }

  return await sendNotFound(res);
}

async function processCommandInstall(meta: Meta): Promise<void> {
  // audit
  if (meta.url.startsWith("/-")) {
    return await sendOkEmpty(meta.res);
  }

  if (meta.parsedUrl.ext) {
    return await processGettingTarball(meta);
  }

  return await processGettingPackageInfo(meta);
}

async function processGettingTarball(meta: Meta): Promise<void> {
  // Check file of local
  if (await accessSoft(meta.tarballPackageFile)) {
    return await sendOk(meta.res, await fs.readFile(meta.tarballPackageFile));
  }

  // Check saved file already
  if (await accessSoft(meta.tarballProxyFile)) {
    return await sendOk(meta.res, await fs.readFile(meta.tarballProxyFile));
  }

  // Get file by proxy
  const data = await meta.data;

  for (const targetUrl of meta.proxyUrls) {
    const { res } = await proxyRequest(meta.req, targetUrl)()(data);

    if (res && res.statusCode === 200) {
      const resData = await getIncomingMessageData(res);

      await fs.mkdir(meta.tarballProxyDir, { recursive: true });
      await fs.writeFile(meta.tarballProxyFile, resData);

      return await sendOk(meta.res, resData);
    }
  }

  return await sendNotFound(meta.res);
}

async function processGettingPackageInfo(meta: Meta): Promise<void> {
  // Check file of local
  if (await accessSoft(meta.infoPackageFile)) {
    return await sendOk(meta.res, await fs.readFile(meta.infoPackageFile));
  }

  // Get file by proxy
  const data = await meta.data;

  for (const targetUrl of meta.proxyUrls) {
    const { res } = await proxyRequest(meta.req, targetUrl)()(data);

    if (res && res.statusCode === 200) {
      const resData = await getIncomingMessageData(res);
      const json = JSON.parse(resData.toString());
      const data = changeHostPackageInfo(json, meta.host);
      const nextJson = JSON.stringify(data);

      await fs.mkdir(meta.infoProxyDir, { recursive: true });
      await fs.writeFile(meta.infoProxyFile, nextJson);

      return await sendOk(meta.res, nextJson);
    }
  }

  // If didn't find file by proxy
  // Try get saved early file
  if (await accessSoft(meta.infoProxyFile)) {
    return await sendOk(meta.res, await fs.readFile(meta.infoProxyFile));
  }

  return await sendNotFound(meta.res);
}

async function processPublishCommand(meta: Meta): Promise<void> {
  const data = await meta.data;
  const pkgInfo: PackageInfo = JSON.parse(data.toString());

  await fs.mkdir(meta.tarballPackageDir, { recursive: true });

  const attachments = Object.entries(pkgInfo._attachments);

  for (const [fileName, { data }] of attachments) {
    const file = path.join(meta.tarballPackageDir, fileName);

    if (await accessSoft(file)) {
      return await sendBadRequest(meta.res);
    }

    await fs.writeFile(file, data, "base64");
  }

  const currInfo = await readJson<PackageInfo>(meta.infoPackageFile);
  const nextInfo: PackageInfo = merge.recursive(
    currInfo ?? {},
    removeProps(pkgInfo, "_attachments")
  );

  await fs.writeFile(meta.infoPackageFile, JSON.stringify(nextInfo));

  return await sendOkEmpty(meta.res);
}

async function processViewCommand(meta: Meta): Promise<void> {
  if (await accessSoft(meta.infoPackageFile)) {
    return await sendOk(meta.res, await fs.readFile(meta.infoPackageFile));
  }

  // Get file by proxy
  const data = await meta.data;

  for (const targetUrl of meta.proxyUrls) {
    const { res } = await proxyRequest(
      meta.req,
      targetUrl
    )((options) => ({
      ...options,
      headers: removeProps(options.headers ?? {}, "accept-encoding"),
    }))(data);

    if (res && res.statusCode === 200) {
      return await sendOk(meta.res, await getIncomingMessageData(res));
    }
  }

  // If didn't find file by proxy
  // Try get saved early file
  if (await accessSoft(meta.infoProxyFile)) {
    return await sendOk(meta.res, await fs.readFile(meta.infoProxyFile));
  }

  return await sendNotFound(meta.res);
}
