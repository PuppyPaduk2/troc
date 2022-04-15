import {
  TrocRequestHandler,
  TrocServer,
  TrocServerData,
  TrocServerOptions,
} from "../troc-server";
import { generateToken } from "../utils/crypto";
import {
  NpmCredentials,
  NpmPackageInfo,
  NpmPackageInfoInstall,
  NpmPackageInfoView,
} from "../utils/npm";
import { removeProps } from "../utils/object";
import { RequestAdapter } from "../utils/request-adapter";
import { RequestMeta } from "../utils/request-meta";

export class ProxyServer extends TrocServer {
  constructor(options: TrocServerOptions) {
    super({
      ...options,
      commandHandlers: options.commandHandlers ?? {
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
      },
      apiHandlers: options.apiHandlers ?? {
        v1: {
          "/signup": ProxyServer.createHandlerPipe([
            ProxyServer.log,
            // TODO Add checking users exist or no
            ProxyServer.handleApiSignup,
          ]),
          "/attach-token": ProxyServer.createHandlerPipe([
            ProxyServer.log,
            ProxyServer.checkToken,
            ProxyServer.handleApiAttachToken,
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
        const info = await new RequestMeta(res).json<NpmPackageInfoView>();

        if (info && !info.error) {
          const data = await adapter.formatterPackageInfo(info, adapter);
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
        const info = await new RequestMeta(res).json<NpmPackageInfoInstall>();

        if (info && !info.error) {
          const data = await adapter.formatterPackageInfo(info, adapter);
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

  // Utils
  static async changeHostPackageInfo(
    info: NpmPackageInfo,
    adapter: RequestAdapter<TrocServerData>
  ): Promise<NpmPackageInfo> {
    const host = adapter.req.headers.host;

    // Change tarball to current host
    Object.entries(info.versions).forEach(([, info]) => {
      const tarball: string = info.dist.tarball;
      const parsedTarball: URL = new URL(tarball);

      parsedTarball.host = host || parsedTarball.host;
      info.dist.tarball = parsedTarball.href;
    });

    return info;
  }
}
