import {
  createServer as createHttpServer,
  Server,
  IncomingMessage,
  ServerResponse,
} from "http";
import * as path from "path";
import * as fs from "fs/promises";
import { bgBlack, bgCyan } from "colors";

import { buildRequestOptions } from "./utils/build-request-options";
import { requests, toRequestProtocol } from "./utils/request-by-protocol";

export async function createNpmProxyServer({
  port,
  proxy,
  hostname = "0.0.0.0",
}: {
  port: number;
  proxy: string[];
  hostname?: string;
}): Promise<Server | Error> {
  if (proxy && proxy.length === 0) {
    return new Error("Proxy is empty");
  }

  proxy = await checkServices(proxy);

  return new Promise((resolve) => {
    const server = createHttpServer(async (req, res) => {
      const reqData = await getIncomingMessageData(req);

      await handlerInstallCommand({ req, reqData, res, proxy });
    });

    server.once("error", (error) => {
      resolve(error);
    });
    server.listen(port, hostname, () => {
      resolve(server);
    });
  });
}

async function checkServices(urls: string[]): Promise<string[]> {
  const result = await Promise.allSettled(
    Array.from(new Set(urls)).map(checkService)
  );

  return Array.from(
    result.reduce<Set<string>>((memo, result, index) => {
      if (result.status === "fulfilled" && !result.value.error) {
        memo.add(urls[index]);
      }

      return memo;
    }, new Set())
  );
}

function checkService(url: string): Promise<{ error: Error | null }> {
  return new Promise((resolve) => {
    const params = buildRequestOptions({ url });
    const request = requests[toRequestProtocol(params.protocol)];
    const req = request(params);
    let error: Error | null = null;

    req.on("error", (_error) => {
      error = _error;
    });
    req.on("close", () => {
      resolve({ error });
    });
    req.end();
  });
}

async function getIncomingMessageData(req: IncomingMessage): Promise<Buffer[]> {
  return new Promise((resolve) => {
    const data: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      data.push(chunk);
    });

    req.on("end", () => {
      resolve(data);
    });
  });
}

async function handlerInstallCommand({
  req,
  res,
  reqData,
  proxy,
}: {
  req: IncomingMessage;
  reqData: Buffer[];
  res: ServerResponse;
  proxy: string[];
}): Promise<void> {
  for (const url of proxy) {
    const headers = req.headers ?? {};
    const session =
      typeof headers["npm-session"] === "string"
        ? headers["npm-session"]
        : null;

    console.log(
      bgBlack.cyan(req.method ?? ""),
      bgCyan.black(session ?? ""),
      req.url,
      url
    );

    const chunks = await requestProxy({ req, reqData, url });

    if (chunks) {
      if (req.url?.startsWith("/-")) {
        res.write(Buffer.concat(chunks));
        res.end();
        return;
      }

      const parsedUrl = path.parse(req.url || "");

      if (parsedUrl.ext) {
        const data = Buffer.concat(chunks);
        const dir = path.join(__dirname, "storage/proxy", parsedUrl.dir);
        const file = path.resolve(dir, parsedUrl.base);

        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, data);
        res.write(data);
        res.end();
        return;
      }

      const data = Buffer.concat(chunks).toString();
      const json: {
        versions: Record<string, { dist: { shasum: string; tarball: string } }>;
      } = JSON.parse(data);
      const versions = Object.entries(json.versions).map(([version, info]) => [
        version,
        Object.assign(info, {
          dist: Object.assign(info.dist, {
            tarball: changeHost(
              info.dist.tarball,
              req.headers.host ?? new URL(info.dist.tarball).host
            ),
          }),
        }),
      ]);

      json.versions = Object.fromEntries(versions);

      const jsonStr = JSON.stringify(json, null, 2);
      const dir = path.join(
        __dirname,
        "storage/proxy",
        parsedUrl.dir,
        parsedUrl.base
      );
      const file = path.resolve(dir, "info.json");

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file, jsonStr);

      res.write(jsonStr);
      res.end();

      return;
    }
  }

  res.statusCode = 404;
  res.end("Not Found");
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
  const params = buildRequestOptions({ url, req });
  const request = requests[toRequestProtocol(params.protocol)];
  const reqProxy = request(params);

  reqProxy.write(Buffer.concat(reqData));

  return await new Promise<Buffer[] | null>((resolve) => {
    reqProxy.on("response", async (resProxy) => {
      if (resProxy.statusCode !== 200) {
        return resolve(null);
      }

      resolve(await getIncomingMessageData(resProxy));
    });
  });
}

function changeHost(url: string, host: string): string {
  const parsedUrl = new URL(url);

  parsedUrl.host = host;

  return parsedUrl.href;
}
