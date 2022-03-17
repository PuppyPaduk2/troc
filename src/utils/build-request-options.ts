import { IncomingMessage, RequestOptions } from "http";
import { join } from "path";

import { removeProps } from "./remove-props";

export function buildRequestOptions({
  url,
  req,
}: {
  url: string;
  req?: IncomingMessage;
}): RequestOptions {
  const parsedUrl = new URL(url);

  return {
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    method: req?.method ?? "GET",
    headers: req?.headers ? removeProps(req.headers, "host") : undefined,
    path: join(parsedUrl.pathname, req?.url ?? ""),
  };
}
