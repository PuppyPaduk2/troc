#!/usr/bin/env node

const { program } = require("commander");
const packageJson = require("../package.json");
const { start } = require("./commands/start");
const { publish } = require("./commands/publish");
const { install } = require("./commands/install");

program.version(packageJson.version);

program.command("start").description("Start server of registry").action(start);

program
  .command("publish")
  .alias("pub")
  .description("Publish packages to local registry")
  .action(publish);

program
  .command("install [tag] [tag2]")
  .alias("i")
  .description("Install packages from local registry")
  .action(install);

program.parse(process.argv);
