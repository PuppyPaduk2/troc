#!/usr/bin/env node

const { program } = require("commander");
const packageJson = require("../package.json");
const { oraPromise } = require("./ora-promise");
const { search } = require("./commands/search");
const { start } = require("./commands/start");

program.version(packageJson.version);

program
  .command("search")
  .description("Search packages to troc")
  .action(() => oraPromise(search(), "Search packages"));

program
  .command("start")
  .description("Start registry troc")
  .action(() => start());

program.parse(process.argv);
