import { Server, createServer as createServerHttp } from "http";
import * as fs from "fs/promises";
import * as path from "path";
import * as merge from "merge";

import { colors } from "../utils/colors";
import { Meta } from "./meta";
import { getIncomingMessageData, proxyRequest } from "../utils/request";
import {
  changeHostPackageInfo,
  NpmResponse,
  PackageInfo,
} from "../utils/package";
import { accessSoft, readJson } from "../utils/fs";
import { Config, ServerConfig, ServerEnvs } from "./config";
import { removeProps } from "../utils/object";
import {
  sendBadRequest,
  sendNotFound,
  sendOk,
  sendServiceUnavailable,
  sendUnauthorized,
} from "./responses";
import { NpmTokenResponse, Tokens } from "./tokens";
import { generateToken } from "../utils/crypto";

export async function createServer(
  config: Partial<ServerConfig> = {},
  envs: Partial<ServerEnvs> = {}
): Promise<Server> {
  const serverConfig = new Config(config, envs);
  const tokens = new Tokens({ config: serverConfig });

  await tokens.read();
  await serverConfig.checkProxyUrls();

  const server = createServerHttp(async (req, res) => {
    const meta: Meta = new Meta({ req, res, serverConfig, tokens });

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
    colors.bgCyan.black(meta.npmSession),
    colors.bgBlack.cyan(meta.method),
    colors.cyan.bold(command),
    meta.url
  );
  console.log(meta.token);

  if (command === "install") {
    return await processCommandInstall(meta);
  } else if (command === "publish") {
    return await processPublishCommand(meta);
  } else if (command === "view") {
    return await processViewCommand(meta);
  } else if (command === "adduser") {
    return await processAdduserCommand(meta);
  } else if (command === "logout") {
    return await processLogoutCommand(meta);
  } else if (command === "whoami") {
    return await processWhoamiCommand(meta);
  }

  return await sendNotFound(res);
}

async function processCommandInstall(meta: Meta): Promise<void> {
  // audit
  if (meta.url.startsWith("/-")) {
    return await sendOk(meta.res);
  }

  if (meta.parsedUrl.ext) {
    return await processGettingTarball(meta);
  }

  return await processGettingPackageInfo(meta);
}

async function processGettingTarball(meta: Meta): Promise<void> {
  // Check saved file already
  if (await accessSoft(meta.tarballFile)) {
    return await sendOk(meta.res, {
      data: await fs.readFile(meta.tarballFile),
    });
  }

  // Get file by proxy
  const dataProxy = await meta.proxy();

  if (!dataProxy) {
    return await sendNotFound(meta.res);
  }

  await fs.mkdir(meta.tarballDir, { recursive: true });
  await fs.writeFile(meta.tarballFile, dataProxy);

  return await sendOk(meta.res, { data: dataProxy });
}

async function processGettingPackageInfo(meta: Meta): Promise<void> {
  // Get file by proxy
  const dataProxy = await meta.proxy();

  // If didn't find file by proxy
  // Try get saved early file
  if (!dataProxy && (await accessSoft(meta.infoFile))) {
    return await sendOk(meta.res, { data: await fs.readFile(meta.infoFile) });
  } else if (!dataProxy) {
    return await sendNotFound(meta.res);
  }

  const json: PackageInfo = JSON.parse(dataProxy.toString());

  if (json.error) {
    return await sendNotFound(meta.res, { data: dataProxy });
  }

  const data = changeHostPackageInfo(json, meta.host);
  const nextJson = JSON.stringify(data);

  await fs.mkdir(meta.infoDir, { recursive: true });
  await fs.writeFile(meta.infoFile, nextJson);

  return await sendOk(meta.res, { data: nextJson });
}

async function processPublishCommand(meta: Meta): Promise<void> {
  const dataProxy = await meta.proxy((targetUrl) => (options) => ({
    ...options,
    headers: {
      ...removeProps(options.headers ?? {}, "accept-encoding"),
      authorization: `Bearer ${meta.tokens.get(meta.token, targetUrl)}`,
    },
  }));

  if (!dataProxy) {
    return await sendBadRequest(meta.res);
  }

  const npmResponse: NpmResponse = JSON.parse(dataProxy.toString());

  if (npmResponse.error) {
    return await sendNotFound(meta.res, { data: dataProxy });
  }

  return await sendOk(meta.res, { data: dataProxy });

  // const data = await meta.data;
  // const pkgInfo: PackageInfo = JSON.parse(data.toString());

  // await fs.mkdir(meta.tarballPackageDir, { recursive: true });

  // const attachments = Object.entries(pkgInfo._attachments);

  // for (const [fileName, { data }] of attachments) {
  //   const file = path.join(meta.tarballPackageDir, fileName);

  //   if (await accessSoft(file)) {
  //     return await sendBadRequest(meta.res);
  //   }

  //   await fs.writeFile(file, data, "base64");
  // }

  // const currInfo = await readJson<PackageInfo>(meta.infoPackageFile);
  // const nextInfo: PackageInfo = merge.recursive(
  //   currInfo ?? {},
  //   removeProps(pkgInfo, "_attachments")
  // );

  // await fs.writeFile(meta.infoPackageFile, JSON.stringify(nextInfo));

  // return await sendOkEmpty(meta.res);
}

async function processViewCommand(meta: Meta): Promise<void> {
  const dataProxy = await meta.proxy(() => (options) => ({
    ...options,
    headers: removeProps(options.headers ?? {}, "accept-encoding"),
  }));

  // If didn't find file by proxy
  // Try get saved early file
  if (!dataProxy && (await accessSoft(meta.infoFile))) {
    return await sendOk(meta.res, { data: await fs.readFile(meta.infoFile) });
  } else if (!dataProxy) {
    return await sendNotFound(meta.res);
  }

  const json: PackageInfo = JSON.parse(dataProxy.toString());

  if (json.error) {
    return await sendNotFound(meta.res, { data: dataProxy });
  }

  const data = changeHostPackageInfo(json, meta.host);
  const nextJson = JSON.stringify(data);

  await fs.mkdir(meta.infoDir, { recursive: true });
  await fs.writeFile(meta.infoFile, nextJson);

  return await sendOk(meta.res, { data: dataProxy });
}

async function processAdduserCommand(meta: Meta): Promise<void> {
  const data = await meta.data;

  for (const targetUrl of meta.proxyUrls) {
    if (!meta.tokens.has(meta.token, targetUrl)) {
      const request = proxyRequest(
        meta.req,
        targetUrl
      )((options) => ({
        ...options,
        headers: removeProps(options.headers ?? {}, "accept-encoding"),
      }));
      const { res } = await request(data);

      if (res) {
        if (res.statusCode === 401) {
          const resData = await getIncomingMessageData(res);

          return await sendUnauthorized(meta.res, {
            data: resData,
            headers: res.headers,
          });
        } else if (Meta.isResSuccessful(meta.res)) {
          const resData = await getIncomingMessageData(res);
          const tokenResponse: NpmTokenResponse = JSON.parse(
            resData.toString()
          );
          const trocToken = meta.tokens.set(
            targetUrl,
            tokenResponse.token,
            meta.token
          );

          await meta.tokens.write();

          console.log(
            colors.bgCyan.black(meta.npmSession),
            colors.bgBlack.green(trocToken)
          );

          return await sendOk(meta.res, {
            data: JSON.stringify({ token: trocToken }),
          });
        }
      }
    }
  }

  return sendServiceUnavailable(meta.res);

  // if (!dataProxy) {
  //   return await sendUnauthorized(meta.res);
  // }

  // return await sendOk(meta.res, dataProxy);

  // const data = await meta.data;
  // const creds = JSON.parse(data.toString());
  // if (!creds.email) {
  //   return await sendUnauthorized(meta.res);
  // }
  // return await sendOk(meta.res, JSON.stringify({ token: "qwe123" }));
}

async function processLogoutCommand(meta: Meta): Promise<void> {
  if (!meta.tokens.has(meta.token)) {
    return await sendBadRequest(meta.res);
  }

  const data = await meta.data;

  for (const targetUrl of meta.proxyUrls) {
    if (meta.tokens.has(meta.token, targetUrl)) {
      const { res } = await proxyRequest(meta.req, targetUrl)()(data);

      console.log(res?.statusCode);

      if (res && Meta.isResSuccessful(res)) {
        meta.tokens.remove(meta.token, targetUrl);
      }
    }
  }

  if (meta.tokens.count(meta.token)) {
    return await sendBadRequest(meta.res);
  }

  meta.tokens.remove(meta.token);
  await meta.tokens.write();

  return await sendOk(meta.res);
}

async function processWhoamiCommand(meta: Meta): Promise<void> {
  console.log(meta.token);
  return await sendOk(meta.res, { data: JSON.stringify({ username: "TTT" }) });
  return await sendBadRequest(meta.res);
}
