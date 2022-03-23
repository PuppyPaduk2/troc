import { program } from "commander";

import { version } from "../package.json";
import { createServer } from "./create-server";

program.command("run-proxy").action(async () => {
  const result = await createServer({ port: 4000 });

  if (result instanceof Error) {
    return;
  }

  console.log(`Server created http://localhost:4000`);
});

program.version(version).parse(process.argv);
