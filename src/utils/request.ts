import * as http from "http";
import * as https from "https";

export type RedirectRequestParams = {
  data?: Buffer | string;
};

export type RedirectedRequest = {
  req: http.ClientRequest;
  res?: http.IncomingMessage;
};

export const redirectRequest = async (
  options: http.RequestOptions,
  params: RedirectRequestParams = {}
): Promise<RedirectedRequest> =>
  await new Promise((resolve) => {
    const { data } = params;
    const netRequest = takeNetRequest(options.protocol ?? "http:");
    const req = netRequest(options);
    if (data) req.write(data, "utf8");
    req.on("response", (res) => resolve({ req, res }));
    req.on("error", () => resolve({ req }));
    req.end();
  });

const takeNetRequest = (protocol: string) => {
  if (protocol === "http:") {
    return http.request;
  } else if (protocol === "https:") {
    return https.request;
  }

  throw new Error("Incorrect request type");
};

export const getIncomingMessageData = (
  request: http.IncomingMessage
): Promise<Buffer> =>
  new Promise((resolve) => {
    const data: Buffer[] = [];
    request.on("data", (chunk: Buffer) => data.push(chunk));
    request.on("end", () => resolve(Buffer.concat(data)));
    request.on("error", () => resolve(Buffer.from([])));
  });

export const getIncomingMessageJson = async <T>(
  request: http.IncomingMessage
): Promise<T | null> => {
  try {
    const data = await getIncomingMessageData(request);
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
};

export const urlToOptions = (url: URL): http.RequestOptions => ({
  protocol: url.protocol || undefined,
  hostname: url.hostname || undefined,
  port: url.port || undefined,
  path: url.pathname || undefined,
});

export const requestToOptions = (
  request: http.IncomingMessage
): http.RequestOptions => ({
  method: request.method ?? "GET",
  headers: request.headers || undefined,
});
