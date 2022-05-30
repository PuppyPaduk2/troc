import * as http from "http";
import * as https from "https";
import * as path from "path";

import { removeProps } from "../utils/object";

import { RequestData } from "./request-data";
import { RequestHeaders } from "./request-headers";
import { RequestUrl } from "./request-url";

const pathJoin = path.join;

export type RequestOptionsFormatter = (
  options: http.RequestOptions
) => http.RequestOptions;

export class RequestNext {
  private _req: http.IncomingMessage;
  public url: RequestUrl;
  public headers: RequestHeaders;
  public data: RequestData;

  constructor(req: http.IncomingMessage) {
    this._req = req;
    this.url = new RequestUrl(req.url);
    this.headers = new RequestHeaders(req.headers);
    this.data = new RequestData(req);
  }

  public get statusCode(): number | null {
    return this._req.statusCode ?? null;
  }

  public get isSuccess(): boolean {
    const status = this.statusCode;
    if (status === null) return false;

    return status >= 200 && status < 300;
  }

  public async proxy(params: {
    targetUrl: string;
    data?: Buffer;
    formatter?: RequestOptionsFormatter;
  }): Promise<{ req: http.ClientRequest; res?: RequestNext }> {
    const { targetUrl } = params;
    const data = params.data ?? (await this.data.value());
    const _formatter: RequestOptionsFormatter =
      params.formatter ?? ((options) => options);
    const formatter: RequestOptionsFormatter = (options) => {
      const headers = removeProps(options.headers ?? {}, "host");
      const url = (this._req.url ?? "").replace(this.url.registry ?? "", "");
      const path = pathJoin(options.path ?? "", url);
      const nextOptions = { ...options, headers, path };
      return _formatter(nextOptions);
    };
    const proxyParams = { req: this._req, targetUrl, data, formatter };
    const proxyResult = await RequestNext.proxyRequest(proxyParams);
    return {
      req: proxyResult.req,
      res: proxyResult.res ? new RequestNext(proxyResult.res) : undefined,
    };
  }

  static proxyRequest(params: {
    req: http.IncomingMessage;
    targetUrl: string;
    formatter?: RequestOptionsFormatter;
    data?: Buffer;
  }) {
    const {
      req,
      targetUrl,
      formatter = (options) => options,
      data = Buffer.from([]),
    } = params;
    const parsedTargetUrl = new URL(targetUrl);
    const options = formatter({
      protocol: parsedTargetUrl.protocol || undefined,
      hostname: parsedTargetUrl.hostname || undefined,
      port: parsedTargetUrl.port || undefined,
      method: req?.method ?? "GET",
      headers: req.headers || undefined,
      path: parsedTargetUrl.pathname || undefined,
    });
    const request = RequestNext.getRequest(options.protocol ?? "http:");

    return new Promise<{
      req: http.ClientRequest;
      res?: http.IncomingMessage;
    }>((resolve) => {
      const reqProxy = request(options);

      if (data) {
        reqProxy.write(data, "utf8");
      }

      reqProxy.on("response", (resProxy) => {
        resolve({ req: reqProxy, res: resProxy });
      });
      reqProxy.on("error", () => {
        resolve({ req: reqProxy });
      });
      reqProxy.end();
    });
  }

  static getRequest(protocol: string) {
    if (protocol === "http:") {
      return http.request;
    } else if (protocol === "https:") {
      return https.request;
    }

    throw new Error("Incorrect request type");
  }
}
