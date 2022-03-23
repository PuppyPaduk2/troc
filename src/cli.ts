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
const defStorageDir = resolve(__dirname, "./storage");

type CommonOptions = {
  port?: string;
  hostname?: string;
  protocol?: string;
  proxy?: string[];
  proxyNpm?: boolean;
  storageDir?: string;
};

// TODO test default value of options of command
program
  .command("run")
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

    const server = await createServer({
      proxy: getProxy(options),
      storageDir: getStorageDir(options),
    });

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

    const npmrcFile = resolve(process.cwd(), npmrcName);
    const npmrcCopyFile = resolve(process.cwd(), npmrcCopyName);
    const isNpmrc = await access(npmrcFile);

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

    const server = await createServer({
      proxy: getProxy(options),
      storageDir: getStorageDir(options),
    }).then((server) => runServer(server, port, hostname, protocol));

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

program.version(version).parse(process.argv);

async function getPort(startPort: number = defPort): Promise<number> {
  for (let port = startPort; port < 65535; port += 1) {
    if (await checkPort(port)) {
      return port;
    }
  }

  throw new Error("Incorrect port");
}

function checkPort(port: number, hostname = defHostname): Promise<boolean> {
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

function getProxy(params: { proxy?: string[]; proxyNpm?: boolean }): string[] {
  return [...(params.proxy ?? []), params.proxyNpm ? npmUrl : ""].filter(
    Boolean
  );
}

function getStorageDir(params: { storageDir?: string }): string {
  return resolve(process.cwd(), params.storageDir ?? defStorageDir);
}

async function runServer(
  server: Server,
  port: number,
  hostname?: string,
  protocol?: string
): Promise<Server | Error> {
  return new Promise<Server | Error>((resolve) => {
    server.on("listening", () => {
      console.log(`Listen ${protocol}//${hostname}:${port}`);
      resolve(server);
    });

    server.on("error", () => {
      const message = "Starting server error";

      console.log(message);
      resolve(new Error(message));
    });

    server.listen(port, hostname);
  });
}
