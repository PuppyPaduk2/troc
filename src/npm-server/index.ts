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

export class NpmServer<DataAdapter = unknown> {
  public server: Server;
  public config: ServerConfig = new ServerConfig();
  public data: DataAdapter;
  public commandHandlers: ServerCommandHandlers<DataAdapter> = {};
  public apiHandlers: ServerApiHandlers<DataAdapter> = {};
  public unknownHandler?: NpmRequestHandler<DataAdapter>;

  constructor(
    server: Server,
    data: DataAdapter,
    options?: {
      config?: ServerConfig;
      commandHandlers?: ServerCommandHandlers<DataAdapter>;
      apiHandlers?: ServerApiHandlers<DataAdapter>;
      unknownHandler?: NpmRequestHandler<DataAdapter>;
      proxies?: RequestProxy[];
    }
  ) {
    this.server = server;
    this.data = data;
    this.config = options?.config ?? this.config;
    this.commandHandlers = options?.commandHandlers ?? this.commandHandlers;
    this.apiHandlers = options?.apiHandlers ?? this.apiHandlers;
    this.unknownHandler = options?.unknownHandler;

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

      if (req.command) return await this.handleCommand(adapter);
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
