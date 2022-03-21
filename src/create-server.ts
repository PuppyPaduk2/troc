import { bgBlack, bgCyan } from "colors";
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

const storageProxyDir = path.resolve(__dirname, "./storage/proxy");
const infoName = "info.json";

type Info = {
  versions: Record<string, { dist: { shasum: string; tarball: string } }>;
};

type CommandHandlerParams = {
  proxy: string[];
  req: IncomingMessage;
  res: ServerResponse;
  reqData: Buffer[];
};

type CommandHandlerResult = Error | null;

const commandHandlers: Record<
  string,
  (params: CommandHandlerParams) => Promise<CommandHandlerResult>
> = {
  install: installHandler,
};

export async function createServer(params: {
  port: number;
  proxy: string[];
  hostname?: string;
}): Promise<Server | Error> {
  const resultCheckParams: Error | null = await checkParams(params);

  if (resultCheckParams instanceof Error) return resultCheckParams;

  const { port, hostname } = params;
  const proxy: string[] = await checkProxy(params.proxy);

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

      const resultHandler = await handler({ proxy, req, res, reqData });

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

async function checkParams({
  proxy,
}: {
  proxy: string[];
}): Promise<Error | null> {
  if (proxy && proxy.length === 0) {
    return new Error("Proxy is empty");
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
    const req = request(getRequestParams(url));
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

function getRequestParams(url: string, req?: IncomingMessage): RequestOptions {
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

export function removeProps<Value extends Record<string, unknown>>(
  value: Value,
  ...keys: string[]
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
  res,
  proxy,
}: CommandHandlerParams): Promise<CommandHandlerResult> {
  const reqUrl: string = decodeURIComponent(req.url ?? "");

  if (!reqUrl) {
    return new Error("Incorrect url");
  }

  console.log(
    bgBlack.cyan(req.method ?? ""),
    bgCyan.black(getSession(req) ?? ""),
    reqUrl
  );

  // audit
  if (req.url?.startsWith("/-")) {
    res.write(Buffer.concat(reqData));
    res.end();
    return null;
  }

  const parsedUrl: path.ParsedPath = path.parse(reqUrl);

  // Send tarball if one exist in storage
  if (parsedUrl.ext) {
    const dir = path.join(storageProxyDir, parsedUrl.dir);
    const file = path.resolve(dir, parsedUrl.base);

    if (await access(file)) {
      const data = await fs.readFile(file);

      res.write(data);
      res.end();
      return null;
    }
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
}: {
  req: IncomingMessage;
  reqData: Buffer[];
  url: string;
}): Promise<Buffer[] | null> {
  return await new Promise<Buffer[] | null>((resolve) => {
    const request = getRequest(url);
    const reqProxy = request(getRequestParams(url, req));

    reqProxy.write(Buffer.concat(reqData));

    reqProxy.on("response", async (resProxy) => {
      if (resProxy.statusCode !== 200) {
        return resolve(null);
      }

      resolve(await getIncomingMessageData(resProxy));
    });

    reqProxy.on("error", () => {
      resolve(null);
    });
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
