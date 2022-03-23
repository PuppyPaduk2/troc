import { program } from "commander";

import { version } from "../package.json";
import { createServer } from "./create-server";

program
  .command("run")
  .option("--port <port>", "Port of server")
  .option("--hostname <hostname>", "Hostname of server")
  .option("--proxy <proxy...>", "Proxy of services")
  .action(
    async ({
      port = 4000,
      hostname = "0.0.0.0",
      proxy = [],
    }: {
      port?: number;
      hostname?: string;
      proxy?: string[];
    }) => {
      const result = await createServer({ port, hostname, proxy });

      if (result instanceof Error) {
        return;
      }

      console.log(`Listen http://${hostname}:${port}`);
    }
  );

program.version(version).parse(process.argv);
