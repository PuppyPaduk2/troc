#!/usr/bin/env node

const { program } = require("commander");
const packageJson = require("../package.json");
const { publish } = require("./commands/publish");
const { start } = require("./commands/start");

program.version(packageJson.version);

program
  .command("publish")
  .description("Publish packages to local registry")
  .action(publish);

program.command("start").description("Start server of registry").action(start);

program.parse(process.argv);
