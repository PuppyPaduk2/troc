import { Server } from "http";

import { RequestAdapter } from "../utils/request-adapter";
import { RequestMeta, RequestProxy } from "../utils/request-meta";
import { ResponseMeta } from "../utils/response-meta";
import { ServerConfig } from "../utils/server-config";

export type NpmRequestHandler<DataAdapter = unknown> = (
  adapter: RequestAdapter<DataAdapter>
) => Promise<RequestAdapter<DataAdapter>>;

export type ServerCommandHandlers<DataAdapter = unknown> = {
  install?: NpmRequestHandler<DataAdapter>;
  publish?: NpmRequestHandler<DataAdapter>;
  view?: NpmRequestHandler<DataAdapter>;
  adduser?: NpmRequestHandler<DataAdapter>;
  logout?: NpmRequestHandler<DataAdapter>;
  whoami?: NpmRequestHandler<DataAdapter>;
};

export type Command = keyof ServerCommandHandlers;

export type ApiVersion = string;

export type ApiPath = string;

export type ServerApiHandlers<DataAdapter = unknown> = Record<
  ApiVersion,
  Record<ApiPath, NpmRequestHandler<DataAdapter>>
>;

export type NpmServerOptions<DataAdapter = unknown> = {
  server: Server;
  data: DataAdapter;
  config?: ServerConfig;
  initHandler?: () => Promise<void>;
  commandHandlers?: ServerCommandHandlers<DataAdapter>;
  apiHandlers?: ServerApiHandlers<DataAdapter>;
  unknownHandler?: NpmRequestHandler<DataAdapter>;
  proxies?: RequestProxy[];
};

export class NpmServer<DataAdapter = unknown> {
  public server: Server;
  public config: ServerConfig = new ServerConfig();
  public data: DataAdapter;
  public isInit = false;
  public initHandler?: () => Promise<void>;
  public commandHandlers: ServerCommandHandlers<DataAdapter> = {};
  public apiHandlers: ServerApiHandlers<DataAdapter> = {};
  public unknownHandler?: NpmRequestHandler<DataAdapter>;

  constructor(options: NpmServerOptions<DataAdapter>) {
    this.server = options.server;
    this.data = options.data;
    this.config = options?.config ?? this.config;
    this.initHandler = options.initHandler;
    this.commandHandlers = options?.commandHandlers ?? this.commandHandlers;
    this.apiHandlers = options?.apiHandlers ?? this.apiHandlers;
    this.unknownHandler = options?.unknownHandler;

    this.server.addListener("listening", async () => {
      if (this.initHandler) await this.initHandler();

      this.isInit = true;
    });

    this.server.addListener("request", async (request, response) => {
      const req: RequestMeta = new RequestMeta(request, {
        proxies: options?.proxies,
      });
      const res: ResponseMeta = new ResponseMeta(response);
      const adapter: RequestAdapter<DataAdapter> = new RequestAdapter({
        req,
        res,
        config: this.config,
        data: this.data,
      });

      if (!this.isInit) return await res.sendServiceUnavailable();
      else if (req.command) return await this.handleCommand(adapter);
      else if (req.api) return await this.handleApi(adapter);
      else if (this.unknownHandler) return await this.unknownHandler(adapter);

      return await res.sendBadRequest();
    });
  }

  private async handleCommand(
    adapter: RequestAdapter<DataAdapter>
  ): Promise<RequestAdapter<DataAdapter>> {
    const handler = this.commandHandlers[adapter.req.command as Command];

    if (handler) {
      return await handler(adapter);
    }

    await adapter.res.sendBadRequest();
    return adapter;
  }

  private async handleApi(
    adapter: RequestAdapter<DataAdapter>
  ): Promise<RequestAdapter<DataAdapter>> {
    const apiVersionHandlers = this.apiHandlers[adapter.req.api?.version ?? ""];
    const apiPathHandler = apiVersionHandlers[adapter.req.api?.path ?? ""];

    if (apiPathHandler) {
      return await apiPathHandler(adapter);
    }

    await adapter.res.sendBadRequest();
    return adapter;
  }

  static createHandler<DataAdapter = unknown>(
    handler: NpmRequestHandler<DataAdapter>
  ): NpmRequestHandler<DataAdapter> {
    return async (adapter) => {
      if (adapter.res.isResponse) {
        return adapter;
      }

      return await handler(adapter);
    };
  }

  static createHandlerPipe<DataAdapter = unknown>(
    handlers: NpmRequestHandler<DataAdapter>[]
  ): NpmRequestHandler<DataAdapter> {
    return NpmServer.createHandler<DataAdapter>(async (adapter) => {
      let result = Promise.resolve(adapter);

      for (const handler of handlers) {
        await result;
        result = NpmServer.createHandler<DataAdapter>(handler)(adapter);
      }

      await result;
      return adapter;
    });
  }
}
