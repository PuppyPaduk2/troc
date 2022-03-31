import {
  IncomingMessage,
  RequestOptions,
  ClientRequest,
  request as httpRequest,
} from "http";
import { request as httpsRequest } from "https";
import * as path from "path";
import { removeProps } from "./object";

export async function getIncomingMessageData(
  req: IncomingMessage
): Promise<Buffer> {
  return new Promise((resolve) => {
    const data: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      data.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(data));
    });

    req.on("error", () => {
      resolve(Buffer.from([]));
    });
  });
}

export type RequestOptionsFormatter = (
  options: RequestOptions
) => RequestOptions;

export function proxyRequest(req: IncomingMessage, targetUrl: string) {
  const request = getRequest(targetUrl);

  return (formatter: RequestOptionsFormatter = (options) => options) => {
    const options = formatter(getRequestOptions(targetUrl, req));

    return (data?: Buffer) => {
      return new Promise<{ req: ClientRequest; res?: IncomingMessage }>(
        (resolve) => {
          const reqProxy = request(options);

          if (data) {
            reqProxy.write(data, "utf8");
          }

          reqProxy.on("response", async (resProxy) => {
            resolve({ req: reqProxy, res: resProxy });
          });

          reqProxy.on("error", () => {
            resolve({ req: reqProxy });
          });

          reqProxy.end();
        }
      );
    };
  };
}

function getRequest(url: string) {
  const protocol = new URL(url).protocol;

  if (protocol === "http:") {
    return httpRequest;
  } else if (protocol === "https:") {
    return httpsRequest;
  }

  throw new Error("Incorrect request type");
}

function getRequestOptions(url: string, req?: IncomingMessage): RequestOptions {
  const parsedUrl = new URL(url);

  return {
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || undefined,
    method: req?.method ?? "GET",
    headers: req?.headers ? removeProps(req.headers, "host") : undefined,
    path: path.join(parsedUrl.pathname, req?.url ?? ""),
  };
}

export async function checkService(url: string): Promise<Error | null> {
  return new Promise((resolve) => {
    const request = getRequest(url);
    const req = request(getRequestOptions(url));
    let error: Error | null = null;

    req.on("error", (_error) => {
      error = _error;
    });

    req.on("close", () => {
      resolve(error);
    });

    req.end();
  });
}
