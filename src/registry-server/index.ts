import * as path from "path";
import * as merge from "merge";

import {
  TrocRequestHandler,
  TrocServer,
  TrocServerOptions,
} from "../troc-server";
import { accessSoft } from "../utils/fs";
import {
  NpmCredentials,
  NpmPackageInfo,
  NpmPackageInfoPublish,
} from "../utils/npm";
import { removeProps } from "../utils/object";
import { generateToken } from "../utils/crypto";

export class RegistryServer extends TrocServer {
  constructor(options: TrocServerOptions) {
    super({
      ...options,
      commandHandlers: options.commandHandlers ?? {
        install: RegistryServer.createHandlerPipe([
          RegistryServer.log,
          RegistryServer.checkToken,
          RegistryServer.handleCommandInstall,
        ]),
        publish: RegistryServer.createHandlerPipe([
          RegistryServer.log,
          RegistryServer.checkToken,
          RegistryServer.handleCommandPublish,
        ]),
        view: RegistryServer.createHandlerPipe([
          RegistryServer.log,
          RegistryServer.checkToken,
          RegistryServer.handleCommandView,
        ]),
        adduser: RegistryServer.createHandlerPipe([
          RegistryServer.log,
          RegistryServer.checkMethod(["POST", "PUT"]),
          RegistryServer.checkCredentials,
          RegistryServer.handleCommandAdduser,
        ]),
        logout: RegistryServer.createHandlerPipe([
          RegistryServer.log,
          RegistryServer.handleCommandLogout,
        ]),
        whoami: RegistryServer.createHandlerPipe([
          RegistryServer.log,
          RegistryServer.checkToken,
          RegistryServer.handleCommandWhoami,
        ]),
      },
      apiHandlers: options.apiHandlers ?? {
        v1: {
          "/signup": TrocServer.createHandlerPipe([
            TrocServer.log,
            RegistryServer.handleApiSignup,
          ]),
        },
      },
    });
  }

  // Commands
  static handleCommandInstall: TrocRequestHandler = async (adapter) => {
    // audit
    if (adapter.req.url.startsWith("/-")) {
      await adapter.res.sendOk();
      return adapter;
    }

    if (adapter.req.parsedUrl.ext) {
      return await RegistryServer.handlerGettingTarball(adapter);
    }

    return await RegistryServer.handlerGettingInfo(adapter);
  };

  static handleCommandPublish: TrocRequestHandler = async (adapter) => {
    const pkgInfo: NpmPackageInfoPublish = (await adapter.req.json()) ?? {
      versions: {},
      _attachments: {},
    };

    await adapter.createTarballDir();

    const attachments = Object.entries(pkgInfo?._attachments ?? {});

    for (const [fileName, { data }] of attachments) {
      const file = path.join(adapter.paths.tarball.dir, fileName);

      if (await accessSoft(file)) {
        await adapter.res.sendBadRequest();
        return adapter;
      }

      await adapter.writeTarballFile(file, data);
    }

    const tokenData = await adapter.data.tokens.get(adapter.req.token);
    const userData = await adapter.data.users.get(tokenData?.username ?? "");

    if (tokenData && userData) {
      for (const [, version] of Object.entries(pkgInfo.versions)) {
        version._npmUser = {
          name: tokenData.username,
          email: userData.email,
        };
      }
    }

    const currInfo = await adapter.readInfoFileJson();
    const nextInfo: NpmPackageInfo = merge.recursive(
      currInfo,
      removeProps(pkgInfo, "_attachments")
    );

    await adapter.writeInfoFile(
      adapter.paths.info.file,
      JSON.stringify(nextInfo, null, 2)
    );

    await adapter.res.sendOk();
    return adapter;
  };

  static handleCommandView: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.accessInfoFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readInfoFile() });
    return adapter;
  };

  static handleCommandAdduser: TrocRequestHandler = async (adapter) => {
    const { req, res } = adapter;
    const data = await req.json<NpmCredentials>();
    const token = generateToken();

    await adapter.data.tokens.set(token, { username: data?.name ?? "" });
    await res.sendOk({ end: JSON.stringify({ token }) });
    return adapter;
  };

  static handleCommandLogout: TrocRequestHandler = async (adapter) => {
    const { req, res, data: db } = adapter;

    if (!req.token || !(await db.tokens.get(req.token))) {
      await res.sendOk();
      return adapter;
    }

    await db.tokens.remove(req.token);
    await res.sendOk();
    return adapter;
  };

  static handleCommandWhoami: TrocRequestHandler = async (adapter) => {
    const { req, res, data: db } = adapter;
    const tokenData = await db.tokens.get(req.token);

    if (!tokenData) {
      await res.sendUnauthorized();
      return adapter;
    }

    await res.sendOk({
      end: JSON.stringify({ username: tokenData.username }),
    });
    return adapter;
  };

  // Api

  // Common
  static handlerGettingTarball: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.accessTarballFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readTarballFile() });
    return adapter;
  };

  static handlerGettingInfo: TrocRequestHandler = async (adapter) => {
    if (!(await adapter.accessInfoFile())) {
      await adapter.res.sendNotFound();
      return adapter;
    }

    await adapter.res.sendOk({ data: await adapter.readInfoFile() });
    return adapter;
  };
}
