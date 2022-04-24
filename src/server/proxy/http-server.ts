import * as http from "http";
import * as path from "path";

import { Adapter, AdapterHandler, AdapterHooks } from "../adapter";
import { checkCredentials, checkMethod, checkToken, log } from "../common";
import { v1Signup } from "../common/api";
import { createPipe } from "../create-pipe";
import { ProxyConfig, ProxyMeta } from "../proxy-meta";
import { RequestMeta } from "../request-meta";
import { ResponseMeta } from "../response-meta";
import { StorageMeta } from "../storage-meta";
import { v1AttachToken } from "./api";
import { adduser, logout, whoami, install, publish, view } from "./commands";

type Options = {
  storageDir?: string;
  proxyConfigs?: ProxyConfig[];
  hooks?: Partial<AdapterHooks>;
};

export const createHttpServer = (options: Options = {}): http.Server => {
  const {
    storageDir = path.join(__dirname, "storage"),
    proxyConfigs = [],
    hooks,
  } = options;
  const server = http.createServer();
  const storage = new StorageMeta({ storageDir });
  const proxy = new ProxyMeta(proxyConfigs);
  let reading: Promise<void> = Promise.resolve();

  server.addListener("listening", async () => {
    reading = storage.readData();
  });

  server.addListener("request", async (req, res) => {
    await reading;

    const adapter = new Adapter({
      request: new RequestMeta(req),
      response: new ResponseMeta(res),
      hooks: { ...Adapter.getHooks(), ...hooks },
      storage,
      proxy,
    });
    const { command, apiParams } = adapter.request;
    let handler: AdapterHandler | null = null;

    if (command) {
      handler = Adapter.getCommandHandler(command, {
        adduser: createPipe([
          log,
          checkMethod(["POST", "PUT"]),
          checkCredentials,
          adduser,
        ]),
        logout: createPipe([log, checkToken(adapter.response.sendOk), logout]),
        whoami: createPipe([log, checkToken(), whoami]),
        install: createPipe([log, checkToken(), install]),
        view: createPipe([log, checkToken(), view]),
        publish: createPipe([log, checkToken(), publish]),
      });
    } else if (apiParams) {
      handler = Adapter.getApiHandler(apiParams, {
        v1: {
          "/signup": createPipe([log, v1Signup]),
          "/attach-token": createPipe([log, checkToken(), v1AttachToken]),
        },
      });
    }

    if (handler) await handler(adapter);

    if (!adapter.response.isResponse) await adapter.response.sendNotFound();
  });

  return server;
};
