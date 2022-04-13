import {
  TrocRequestHandler,
  TrocServer,
  TrocServerOptions,
} from "../troc-server";
import { generateToken } from "../utils/crypto";
import { NpmCredentials } from "../utils/npm";
import { removeProps } from "../utils/object";
import { changeHostPackageInfo, PackageInfo } from "../utils/package";
import { RequestMeta } from "../utils/request-meta";

export class ProxyServer extends TrocServer {
  constructor(options: TrocServerOptions) {
    const commandHandlers: TrocServerOptions["commandHandlers"] =
      options.commandHandlers ?? {
        install: ProxyServer.createHandlerPipe([
          ProxyServer.log,
          ProxyServer.checkToken,
          ProxyServer.handleCommandInstall,
        ]),
        view: ProxyServer.createHandlerPipe([
          ProxyServer.log,
          ProxyServer.checkToken,
          ProxyServer.handleCommandView,
        ]),
        adduser: ProxyServer.createHandlerPipe([
          ProxyServer.log,
          ProxyServer.checkCredentials,
          ProxyServer.handleCommandAdduser,
        ]),
        logout: ProxyServer.createHandlerPipe([
          ProxyServer.log,
          ProxyServer.handleCommandLogout,
        ]),
        whoami: ProxyServer.createHandlerPipe([
          ProxyServer.log,
          ProxyServer.checkToken,
          ProxyServer.handleCommandWhoami,
        ]),
        publish: ProxyServer.createHandlerPipe([
          ProxyServer.log,
          ProxyServer.checkToken,
          ProxyServer.handleCommandPublish,
        ]),
      };
    const apiHandlers: TrocServerOptions["apiHandlers"] =
      options.apiHandlers ?? {
        v1: {
          "/signup": ProxyServer.createHandlerPipe([
            ProxyServer.log,
            ProxyServer.handleApiSignup,
          ]),
          "/attach-token": ProxyServer.createHandlerPipe([
            ProxyServer.log,
            ProxyServer.checkToken,
            ProxyServer.handleApiAttachToken,
          ]),
        },
      };

    super({ ...options, commandHandlers, apiHandlers });
  }

  // Commands
  static handleCommandInstall: TrocRequestHandler = async (adapter) => {
    // audit
    if (adapter.req.url.startsWith("/-")) {
      await adapter.res.sendOk();
      return adapter;
    }

    if (adapter.req.parsedUrl.ext) {
      return await ProxyServer.handlerGettingTarball(adapter);
    }

    return await ProxyServer.handlerGettingInfo(adapter);
  };

  static handleCommandView: TrocRequestHandler = async (adapter) => {
    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...removeProps(options.headers ?? {}, "accept-encoding"),
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        const info = await new RequestMeta(res).json<PackageInfo>();

        if (info && !info.error) {
          const data = changeHostPackageInfo(info, adapter.req.headers.host);
          const dataJson = JSON.stringify(data, null, 2);

          await adapter.createInfoDir();
          await adapter.writeInfoFile(adapter.paths.info.file, dataJson);
          await adapter.res.sendOk({ end: dataJson });

          return adapter;
        }
      }
    }

    if (await adapter.accessInfoFile()) {
      await adapter.res.sendOk({ end: await adapter.readInfoFile() });
      return adapter;
    }

    await adapter.res.sendNotFound();
    return adapter;
  };

  static handleCommandAdduser: TrocRequestHandler = async (adapter) => {
    const data = await adapter.req.json<NpmCredentials>();
    const token = generateToken();

    await adapter.data.tokens.set(token, { username: data?.name ?? "" });
    await adapter.res.sendOk({ end: JSON.stringify({ token }) });
    return adapter;
  };

  static handleCommandLogout: TrocRequestHandler = async (adapter) => {
    if (
      !adapter.req.token ||
      !(await adapter.data.tokens.get(adapter.req.token))
    ) {
      await adapter.res.sendOk();
      return adapter;
    }

    await adapter.data.tokens.remove(adapter.req.token);
    await adapter.data.sessions.remove(adapter.req.token);
    await adapter.res.sendOk();
    return adapter;
  };

  static handleCommandWhoami: TrocRequestHandler = async (adapter) => {
    const tokenData = await adapter.data.tokens.get(adapter.req.token);

    if (!tokenData) {
      await adapter.res.sendUnauthorized();
      return adapter;
    }

    await adapter.res.sendOk({
      end: JSON.stringify({ username: tokenData.username }),
    });
    return adapter;
  };

  static handleCommandPublish: TrocRequestHandler = async (adapter) => {
    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...removeProps(options.headers ?? {}, "accept-encoding"),
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        await adapter.res.sendOk({ end: await new RequestMeta(res).data() });
        return adapter;
      }
    }

    await adapter.res.sendBadRequest();
    return adapter;
  };

  // Api
  static handleApiAttachToken: TrocRequestHandler = async (adapter) => {
    const data = await adapter.req.json<{
      registryUrl: string;
      token: string;
    }>();

    if (!data) {
      await adapter.res.sendBadRequest();
      return adapter;
    }

    const session = (await adapter.data.sessions.get(adapter.req.token)) ?? {
      registries: {},
    };
    await adapter.data.sessions.set(adapter.req.token, {
      ...session,
      registries: {
        ...session.registries,
        [data.registryUrl]: data.token,
      },
    });

    await adapter.res.sendOk();
    return adapter;
  };

  // Common
  static handlerGettingTarball: TrocRequestHandler = async (adapter) => {
    if (await adapter.accessTarballFile()) {
      await adapter.res.sendOk({ end: await adapter.readTarballFile() });
      return adapter;
    }

    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...options.headers,
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        const data = await new RequestMeta(res).data();

        await adapter.createTarballDir();
        await adapter.writeTarballFile(adapter.paths.tarball.file, data);
        await adapter.res.sendOk({ end: data });

        return adapter;
      }
    }

    await adapter.res.sendNotFound();
    return adapter;
  };

  static handlerGettingInfo: TrocRequestHandler = async (adapter) => {
    for (const targetUrl of adapter.req.proxyUrls) {
      console.log(" ", "-".padStart(4), targetUrl);

      const session = await adapter.data.sessions.get(adapter.req.token);
      const { res } = await adapter.req.proxy(targetUrl, (options) => ({
        ...options,
        headers: {
          ...options.headers,
          authorization: ProxyServer.getAuthorization(
            session?.registries[targetUrl]
          ),
        },
      }));

      if (res && RequestMeta.isSuccess(res.statusCode ?? 0)) {
        const info = await new RequestMeta(res).json<PackageInfo>();

        if (info && !info.error) {
          const data = changeHostPackageInfo(info, adapter.req.headers.host);
          const dataJson = JSON.stringify(data, null, 2);

          await adapter.createInfoDir();
          await adapter.writeInfoFile(adapter.paths.info.file, dataJson);
          await adapter.res.sendOk({ end: dataJson });

          return adapter;
        }
      }
    }

    if (await adapter.accessInfoFile()) {
      await adapter.res.sendOk({ end: await adapter.readInfoFile() });
      return adapter;
    }

    await adapter.res.sendNotFound();
    return adapter;
  };

  static getAuthorization(token?: string): string {
    if (!token) return "";
    return `Bearer ${token}`;
  }
}
