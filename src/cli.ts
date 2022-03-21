import { program } from "commander";

import { version } from "../package.json";
import { createServer } from "./create-server";

program.command("run-proxy").action(async () => {
  await createServer({ port: 4000, proxy: [] });
  console.log(`Server created http://localhost:4000`);
});

program.version(version).parse(process.argv);
