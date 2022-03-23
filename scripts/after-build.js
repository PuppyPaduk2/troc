const { spawn } = require("child_process");
const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

function chmodXFile(file) {
  const child = spawn("chmod", ["+x", file]);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  return child;
}

async function addBinNode(file) {
  return readFile(file)
    .then((data) => data.toString())
    .then((data) => {
      if (!data.match(/^#!\/usr/)) {
        writeFile(file, `#!/usr/bin/env node\n${data}`);
      }
    });
}

const file = resolve(__dirname, "../dist/cli.js");

chmodXFile(file);
addBinNode(file);
