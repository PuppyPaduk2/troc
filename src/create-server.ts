import { bgBlack, bgCyan, cyan } from "colors";
import {
  createServer as createHttpServer,
  Server,
  IncomingMessage,
  ServerResponse,
  request as httpRequest,
  RequestOptions,
} from "http";
import { request as httpsRequest } from "https";
import * as path from "path";
import * as fs from "fs/promises";
import { recursive as mergeRecursive } from "merge";

const storageDir = path.resolve(__dirname, "./storage");
const storageProxyDir = path.resolve(storageDir, "./proxy");
const storagePublishDir = path.resolve(storageDir, "./publish");
const infoName = "info.json";
const defHostname = "0.0.0.0";

type Info = {
  versions: Record<string, { dist: { shasum: string; tarball: string } }>;
};

export type ServerOptions = {
  port: number;
  hostname?: string;
  protocol?: string;
  proxy?: string[];
};

type CommandHandlerParams = {
  proxy: string[];
  req: IncomingMessage;
  res: ServerResponse;
  reqData: Buffer[];
  reqUrl: string;
};

type CommandHandlerResult = Error | null;

const commandHandlers: Record<
  string,
  (params: CommandHandlerParams) => Promise<CommandHandlerResult>
> = {
  install: installHandler,
  publish: publishHandler,
  view: viewHandler,
};

export async function createServer(
  params: ServerOptions
): Promise<Server | Error> {
  const resultCheckParams: Error | null = await checkParams(params);

  if (resultCheckParams instanceof Error) return resultCheckParams;

  const { port, hostname = defHostname } = params;
  const proxy: string[] = params.proxy ? await checkProxy(params.proxy) : [];

  return new Promise<Server | Error>((resolve) => {
    const server = createHttpServer(async (req, res) => {
      const send403 = () => {
        res.statusCode = 403;
        res.end("Forbidden");
      };

      const reqData = await getIncomingMessageData(req);

      if (!reqData) {
        return send403();
      }

      const command = getCommand(req);

      if (!command) {
        return send403();
      }

      const handler = commandHandlers[command];

      if (!handler) {
        return send403();
      }

      const reqUrl: string = decodeURIComponent(req.url ?? "");

      console.log(
        bgBlack.cyan(req.method ?? ""),
        bgCyan.black(getSession(req) ?? ""),
        cyan.bold(command),
        reqUrl
      );

      const resultHandler = await handler({ proxy, req, res, reqData, reqUrl });

      if (resultHandler instanceof Error) {
        return send403();
      }
    });

    server.once("error", (error) => {
      resolve(error);
    });
    server.listen(port, hostname, () => {
      resolve(server);
    });
  });
}

async function checkParams(params: ServerOptions): Promise<Error | null> {
  if (!("port" in params)) {
    return new Error("Port is empty");
  }

  if ("proxy" in params && !Array.isArray(params.proxy)) {
    return new Error("Proxy is incorrect type");
  }

  return null;
}

async function checkProxy(proxy: string[]): Promise<string[]> {
  const uniqProxy = Array.from(new Set(proxy));
  const resultChecks = await Promise.allSettled(uniqProxy.map(checkService));
  const correctProxy = resultChecks.reduce<Set<string>>(
    (memo, result, index) => {
      if (result.status === "fulfilled" && !(result.value instanceof Error)) {
        memo.add(proxy[index]);
      }

      return memo;
    },
    new Set()
  );

  return Array.from(correctProxy);
}

async function checkService(url: string): Promise<Error | null> {
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
    port: parsedUrl.port,
    method: req?.method ?? "GET",
    headers: req?.headers ? removeProps(req.headers, "host") : undefined,
    path: path.join(parsedUrl.pathname, req?.url ?? ""),
  };
}

export function removeProps<Value extends object>(
  value: Value,
  ...keys: (keyof Value)[]
): Value {
  const result = Object.assign({}, value);

  for (const key of keys) {
    if (key in value) delete result[key];
  }

  return result;
}

async function getIncomingMessageData(
  req: IncomingMessage
): Promise<Buffer[] | null> {
  return new Promise((resolve) => {
    const data: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      data.push(chunk);
    });

    req.on("end", () => {
      resolve(data);
    });

    req.on("error", () => {
      resolve(null);
    });
  });
}

function getCommand(req: IncomingMessage): string | null {
  const referer: string | null = req.headers?.referer ?? null;

  return referer?.split(" ")[0] ?? null;
}

async function installHandler({
  req,
  reqData,
  reqUrl,
  res,
  proxy,
}: CommandHandlerParams): Promise<CommandHandlerResult> {
  if (!reqUrl) {
    return new Error("Incorrect url");
  }

  // audit
  if (req.url?.startsWith("/-")) {
    res.end();
    return null;
  }

  const parsedUrl: path.ParsedPath = path.parse(reqUrl);

  // Send tarball if one exist in storage
  if (parsedUrl.ext) {
    // Check published package in storage
    let dir = path.join(storagePublishDir, parsedUrl.dir);
    let file = path.resolve(dir, parsedUrl.base);

    if (await access(file)) {
      const data = await fs.readFile(file);

      res.write(data);
      res.end();
      return null;
    }

    dir = path.join(storageProxyDir, parsedUrl.dir);
    file = path.resolve(dir, parsedUrl.base);

    if (await access(file)) {
      const data = await fs.readFile(file);

      res.write(data);
      res.end();
      return null;
    }
  }

  // Check published package in storage
  const dir = path.join(storagePublishDir, parsedUrl.dir, parsedUrl.base);
  const file = path.resolve(dir, infoName);

  if (await access(file)) {
    const data = await fs.readFile(file);

    res.write(data);
    res.end();
    return null;
  }

  // Proxy to services
  for (const url of proxy) {
    const resultRequestProxy: Buffer[] | null = await requestProxy({
      req,
      reqData,
      url,
    });

    if (Array.isArray(resultRequestProxy)) {
      // Handle file tarball
      if (parsedUrl.ext) {
        const data = Buffer.concat(resultRequestProxy);
        const dir = path.join(storageProxyDir, parsedUrl.dir);
        const file = path.resolve(dir, parsedUrl.base);

        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, data);
        res.write(data);
        res.end();
        return null;
      }

      // Handle info of package
      const data = Buffer.concat(resultRequestProxy).toString();
      const info: Info = JSON.parse(data);

      // Change tarball to current host
      Object.entries(info.versions).forEach(([, info]) => {
        const tarball: string = info.dist.tarball;
        const parsedTarball: URL = new URL(tarball);

        parsedTarball.host = req.headers.host ?? parsedTarball.host;
        info.dist.tarball = parsedTarball.href;
      });

      const infoStr = JSON.stringify(info, null, 2);
      const dir = path.join(storageProxyDir, parsedUrl.dir, parsedUrl.base);
      const file = path.resolve(dir, infoName);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file, infoStr);
      res.write(infoStr);
      res.end();

      return null;
    }
  }

  // Check info.json in storage
  if (!parsedUrl.ext) {
    const dir = path.join(storageProxyDir, parsedUrl.dir, parsedUrl.base);
    const file = path.resolve(dir, infoName);

    if (await access(file)) {
      const data = await fs.readFile(file);

      res.write(data);
      res.end();
      return null;
    }
  }

  return new Error("Command install didn't process");
}

function getSession(req: IncomingMessage): string | null {
  const headers = req.headers ?? {};
  const session = headers["npm-session"];

  return typeof session === "string" ? session : null;
}

async function requestProxy({
  req,
  reqData,
  url,
  onOptions = (options) => options,
}: {
  req: IncomingMessage;
  reqData: Buffer[];
  url: string;
  onOptions?: (options: RequestOptions) => RequestOptions;
}): Promise<Buffer[] | null> {
  return await new Promise<Buffer[] | null>((resolve) => {
    const request = getRequest(url);
    const options = getRequestOptions(url, req);
    const reqProxy = request(onOptions(options));

    reqProxy.write(Buffer.concat(reqData), "utf8");

    reqProxy.on("response", async (resProxy) => {
      if (resProxy.statusCode !== 200) {
        return resolve(null);
      }

      resolve(await getIncomingMessageData(resProxy));
    });

    reqProxy.on("error", () => {
      resolve(null);
    });

    reqProxy.end();
  });
}

async function access(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function publishHandler({
  reqData,
  reqUrl,
  res,
}: CommandHandlerParams): Promise<CommandHandlerResult> {
  const reqInfo: { _attachments: Record<string, { data: string }> } =
    JSON.parse(Buffer.concat(reqData).toString());
  const dir = path.join(storagePublishDir, reqUrl);
  const tarballDir = path.join(dir, "-");

  await fs.mkdir(tarballDir, { recursive: true });

  const attachments = Object.entries<{ data: string }>(reqInfo._attachments);

  for (const [fileName, { data }] of attachments) {
    const file = path.join(tarballDir, fileName);
    const isAccess = await access(file);

    if (isAccess) {
      res.statusCode = 400;
      res.end("Version of package exist already");

      return null;
    }

    await fs.writeFile(file, data, "base64");
  }

  const file = path.join(dir, infoName);
  let info = (await readJson(file)) || {};

  info = mergeRecursive(info, removeProps(reqInfo, "_attachments"));

  await fs.writeFile(file, JSON.stringify(info, null, 2));

  res.end();

  return null;
}

async function readJson(file: string): Promise<object | null> {
  try {
    return JSON.parse((await fs.readFile(file)).toString());
  } catch {
    return null;
  }
}

async function viewHandler({
  req,
  reqUrl,
  reqData,
  res,
  proxy,
}: CommandHandlerParams): Promise<CommandHandlerResult> {
  // Check published package
  let dir = path.join(storagePublishDir, reqUrl);
  let file = path.resolve(dir, infoName);

  if (await access(file)) {
    const data = await fs.readFile(file);

    res.write(data);
    res.end();
    return null;
  }

  // Check proxy package
  for (const url of proxy) {
    const resultRequestProxy: Buffer[] | null = await requestProxy({
      req,
      reqData,
      url,
      onOptions: (options) => {
        if (options.headers && "accept-encoding" in options.headers) {
          delete options.headers;
        }

        return options;
      },
    });

    if (Array.isArray(resultRequestProxy)) {
      res.write(Buffer.concat(resultRequestProxy));
      res.end();
      return null;
    }
  }

  // Check saved proxy package
  dir = path.join(storageProxyDir, reqUrl);
  file = path.resolve(dir, infoName);

  if (await access(file)) {
    const data = await fs.readFile(file);

    res.write(data);
    res.end();
    return null;
  }

  return new Error("Command view didn't process");
}
