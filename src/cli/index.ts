import { program } from "commander";

import { version } from "../../package.json";

const startCommands = program.command("start");

startCommands.command("server").action(async () => {
  console.log("start server");
});

program.version(version).parse(process.argv);
