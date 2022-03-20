import { program } from "commander";

import { version } from "../package.json";
import { createNpmProxyServer } from "./npm-proxy-server";

program.command("run-proxy").action(async () => {
  await createNpmProxyServer({ port: 4000, proxy: [] });
  console.log(`Server created http://localhost:4000`);
});

program.version(version).parse(process.argv);
