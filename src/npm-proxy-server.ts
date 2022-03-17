import { createServer as createHttpServer, Server } from "http";

import { buildRequestOptions } from "./utils/build-request-options";
import { checkService } from "./utils/check-service";
import { requests, toRequestProtocol } from "./utils/request-by-protocol";

type CreateServerResult = { error: Error } | { server: Server };

export async function createServer({
  port,
  proxy,
  hostname = "0.0.0.0",
}: {
  port: number;
  proxy: string[];
  hostname?: string;
}): Promise<CreateServerResult> {
  if (proxy && proxy.length === 0) {
    return { error: new Error("Proxy is empty") };
  }

  const resultCheckServices = await Promise.allSettled(proxy.map(checkService));
  const correctProxy: Set<string> = resultCheckServices.reduce<Set<string>>(
    (memo, result, index) => {
      if (result.status === "fulfilled" && !result.value.error) {
        memo.add(proxy[index]);
      }

      return memo;
    },
    new Set()
  );

  return new Promise<CreateServerResult>((resolve) => {
    const server = createHttpServer(async (req, res) => {
      const body: Buffer[] = [];

      req.on("data", (chunk: Buffer) => body.push(chunk));
      req.on("end", () => {
        for (const url of correctProxy) {
          console.log(url);

          const params = buildRequestOptions({ url, req });
          const request = requests[toRequestProtocol(params.protocol)];

          const reqProxy = request(params, (resProxy) => {
            resProxy.statusCode === 200 && resProxy.pipe(res);
          });

          body.forEach((chunk) => reqProxy.write(chunk));
          reqProxy.on("error", (error) => {
            console.log(error);
          });
          reqProxy.end();
        }
      });
    });

    server.once("error", (error) => resolve({ error }));
    server.listen(port, hostname, () => resolve({ server }));
  });
}
