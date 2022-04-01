import { program } from "commander";
import { spawn } from "child_process";
import { copyFile, writeFile, rm } from "fs/promises";
import * as path from "path";
import prompts from "prompts";

import { version } from "../../package.json";
import { createProxyServer } from "../create-proxy-server";
import { accessSoft } from "../utils/fs";
import { getPort } from "../utils/net";
import {
  CommonOptions,
  defHostname,
  defPort,
  defProtocol,
  getServerConfig,
  npmrcCopyName,
  npmrcName,
  runServer,
} from "./utils";
import { fetch } from "../utils/fetch";

program
  .command("run")
  .command("proxy-server")
  .option("--port <port>", "Port of server")
  .option("--hostname <hostname>", "Hostname of server")
  .option("--protocol <protocol>", "Protocol of server")
  .option("--proxy <proxy...>", "Proxy of services")
  .option("--no-proxy-npm")
  .option("--storage-dir <storageDir>", "Directory of storage")
  .action(async (options: CommonOptions) => {
    const protocol = options.protocol ?? defProtocol;
    const hostname = options.hostname ?? defHostname;
    const port = await getPort(options.port ? +options.port : defPort);

    const server = await createProxyServer(getServerConfig(options));

    await runServer(server, port, hostname, protocol);
  });

program
  .command("install <pkg...>")
  .alias("i")
  .option("-P, --save-prod")
  .option("-D, --save-dev")
  .option("-O, --save-optional")
  .option("-E, --save-exact")
  .option("--no-save")
  .option("--port <port>", "Port of server")
  .option("--hostname <hostname>", "Hostname of server")
  .option("--protocol <protocol>", "Protocol of server")
  .option("--proxy <proxy...>", "Proxy of services")
  .option("--no-proxy-npm")
  .option("--storage-dir <storageDir>", "Directory of storage")
  .action(async (pkg, options) => {
    const args1 = [
      options.saveProd && "--save-prod",
      options.saveDev && "--save-dev",
      options.saveOptional && "--save-optional",
    ].filter(Boolean)[0];
    const args2 = [options.saveExact && "--save-exact"].filter(Boolean)[0];
    const args3 = [!options.save && "--no-save"].filter(Boolean)[0];
    const args = [args1, args2, args3].filter(Boolean);

    const npmrcFile = path.resolve(process.cwd(), npmrcName);
    const npmrcCopyFile = path.resolve(process.cwd(), npmrcCopyName);
    const isNpmrc = await accessSoft(npmrcFile);

    if (isNpmrc) {
      await copyFile(npmrcFile, npmrcCopyFile);
    }

    const protocol = options.protocol ?? defProtocol;
    const hostname = options.hostname ?? defHostname;
    const port = await getPort(options.port ? +options.port : defPort);

    await writeFile(npmrcFile, `registry=${protocol}//${hostname}:${port}\n`);

    const revertNpmrc = async () => {
      await rm(npmrcFile);

      if (isNpmrc) {
        await copyFile(npmrcCopyFile, npmrcFile);
        await rm(npmrcCopyFile);
      }
    };

    const server = await createProxyServer(getServerConfig(options)).then(
      (server) => runServer(server, port, hostname, protocol)
    );

    if (server instanceof Error) {
      return revertNpmrc();
    }

    const code = await new Promise<number | null>((resolved) => {
      const npmInstallProcess = spawn("npm", ["install", ...pkg, ...args], {
        cwd: process.cwd(),
      });

      npmInstallProcess.stdout.pipe(process.stdout);
      npmInstallProcess.stderr.pipe(process.stderr);

      npmInstallProcess.on("close", (code) => {
        resolved(code);
      });
    });

    server.close();
    await revertNpmrc();
    process.exit(code ?? undefined);
  });

program.command("signup").action(async () => {
  const creds = await prompts([
    { type: "text", name: "login", message: "Login" },
    { type: "password", name: "password", message: "Password" },
    { type: "text", name: "email", message: "Email" },
  ]);

  const res = await fetch("http://localhost:5000/api/v1/signup", {
    method: "POST",
    body: JSON.stringify(creds),
  });

  console.log(res.status);
});

program.version(version).parse(process.argv);
