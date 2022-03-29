import { ServerResponse } from "http";

export async function sendNotFound(res: ServerResponse): Promise<void> {
  res.statusCode = 404;
  res.end("Not found");
}

export async function sendOkEmpty(res: ServerResponse): Promise<void> {
  res.statusCode = 200;
  res.end();
}

export async function sendOk(
  res: ServerResponse,
  data: Buffer | string
): Promise<void> {
  res.statusCode = 200;
  res.write(data);
  res.end();
}

export async function sendBadRequest(res: ServerResponse): Promise<void> {
  res.statusCode = 400;
  res.end("Bad request");
}
