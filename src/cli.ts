import { program } from "commander";
import { Server } from "net";
import { spawn } from "child_process";
import { copyFile, access as fsAccess, writeFile, rm } from "fs/promises";
import { resolve } from "path";

import { version } from "../package.json";
import { createServer, ServerOptions } from "./create-server";

const npmUrl = "https://registry.npmjs.org";
const defPort = 4000;
const defHostname = "0.0.0.0";
const defProtocol = "http:";
const npmrcName = ".npmrc";
const npmrcCopyName = ".npmrc-copy";

program
  .command("run")
  .option("--port <port>", "Port of server")
  .option("--hostname <hostname>", "Hostname of server")
  .option("--protocol <protocol>", "Protocol of server")
  .option("--proxy <proxy...>", "Proxy of services")
  .option("--no-proxy-npm")
  .action(async (options: RunServerOptions) => {
    await runServer(options);
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
  .action(async (pkg, options) => {
    const args1 = [
      options.saveProd && "--save-prod",
      options.saveDev && "--save-dev",
      options.saveOptional && "--save-optional",
    ].filter(Boolean)[0];
    const args2 = [options.saveExact && "--save-exact"].filter(Boolean)[0];
    const args3 = [!options.save && "--no-save"].filter(Boolean)[0];
    const args = [args1, args2, args3].filter(Boolean);

    const npmrcFile = resolve(process.cwd(), npmrcName);
    const npmrcCopyFile = resolve(process.cwd(), npmrcCopyName);
    const isNpmrc = await access(npmrcFile);
    const serverOptions: ServerOptions = await getServerOptions({
      port: options.port,
      hostname: options.hostname,
      protocol: options.protocol,
      proxy: options.proxy,
      proxyNpm: options.proxyNpm,
    });

    if (isNpmrc) {
      await copyFile(npmrcFile, npmrcCopyFile);
    }

    await writeFile(
      npmrcFile,
      `registry=${serverOptions.protocol}//${serverOptions.hostname}:${serverOptions.port}\n`
    );

    const server = await runServer(serverOptions);

    if (server instanceof Error) {
      return;
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

    await rm(npmrcFile);

    if (isNpmrc) {
      await copyFile(npmrcCopyFile, npmrcFile);
      await rm(npmrcCopyFile);
    }

    process.exit(code ?? undefined);
  });

program.version(version).parse(process.argv);

type RunServerOptions = {
  port?: number;
  hostname?: string;
  protocol?: string;
  proxy?: string[];
  proxyNpm?: boolean;
};

async function runServer({
  port = defPort,
  hostname = defHostname,
  protocol = defProtocol,
  proxy = [],
  proxyNpm = true,
}: RunServerOptions): Promise<Server | Error> {
  const server = await createServer({
    port,
    hostname,
    proxy: [...proxy, proxyNpm ? npmUrl : ""].filter(Boolean),
  });

  if (server instanceof Error) {
    console.log("Starting server error");
    return server;
  }

  console.log(`Listen ${protocol}//${hostname}:${port}`);
  return server;
}

async function getServerOptions({
  port = defPort,
  hostname = defHostname,
  protocol = defProtocol,
  proxy = [],
  proxyNpm = true,
}: RunServerOptions): Promise<ServerOptions> {
  return {
    port: await getPort(port),
    hostname,
    protocol,
    proxy: [...proxy, proxyNpm ? npmUrl : ""].filter(Boolean),
  };
}

async function getPort(startPort: number): Promise<number> {
  for (let port = startPort; port < 65535; port += 1) {
    if (await checkPort(port)) {
      return port;
    }
  }

  throw new Error("Incorrect port");
}

function checkPort(port: number, hostname = "0.0.0.0"): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = new Server();

    server.on("error", () => {
      resolve(false);
    });

    server.on("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, hostname);
  });
}

async function access(file: string): Promise<boolean> {
  try {
    await fsAccess(file);
    return true;
  } catch {
    return false;
  }
}
