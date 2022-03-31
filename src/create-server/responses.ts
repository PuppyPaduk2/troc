import { ServerResponse, IncomingHttpHeaders } from "http";

type SendOptions = {
  data?: Buffer | string;
  headers?: IncomingHttpHeaders;
  end?: string | Buffer;
};

export async function send(
  res: ServerResponse,
  statusCode: number,
  options?: SendOptions
): Promise<void> {
  res.writeHead(statusCode, options?.headers);

  if (options?.data) {
    res.write(options.data);
  }

  res.end(options?.end);
}

export async function sendNotFound(
  res: ServerResponse,
  options?: SendOptions
): Promise<void> {
  await send(res, 404, { end: "Not found", ...options });
}

export async function sendOk(
  res: ServerResponse,
  options?: SendOptions
): Promise<void> {
  await send(res, 200, { ...options });
}

export async function sendBadRequest(
  res: ServerResponse,
  options?: SendOptions
): Promise<void> {
  await send(res, 400, { end: "Bad request", ...options });
}

export async function sendUnauthorized(
  res: ServerResponse,
  options?: SendOptions
): Promise<void> {
  await send(res, 401, { end: "Unauthorized", ...options });
}

export async function sendServiceUnavailable(
  res: ServerResponse,
  options?: SendOptions
): Promise<void> {
  await send(res, 503, { end: "Service Unavailable", ...options });
}
