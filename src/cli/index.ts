import { program } from "commander";
import prompts from "prompts";

import { version } from "../../package.json";
import { createProxyServer } from "../create-proxy-server";
import { getPort } from "../utils/net";
import {
  CommonOptions,
  defHostname,
  defPort,
  defProtocol,
  getServerConfig,
  runServer,
} from "./utils";
import { fetch } from "../utils/fetch";
import { getNpmConfigValue, getRegistryConfig } from "../utils/npm";

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

program.command("signup").action(async () => {
  const registry = "http://localhost:5000";
  const creds = await prompts([
    { type: "text", name: "login", message: "Login" },
    { type: "password", name: "password", message: "Password" },
    { type: "text", name: "email", message: "Email" },
  ]);

  const res = await fetch(`${registry}/api/v1/signup`, {
    method: "POST",
    body: JSON.stringify(creds),
  });

  console.log(res.status);
});

const token = program.command("token");

token.command("create").action(async () => {
  const registryUrl = new URL(await getNpmConfigValue("registry"));
  const creds = await prompts([
    { type: "text", name: "login", message: "Login" },
    { type: "password", name: "password", message: "Password" },
  ]);
  registryUrl.pathname = "/api/v1/token";

  const res = await fetch(registryUrl.href, {
    method: "POST",
    body: JSON.stringify(creds),
  });

  console.log(await res.json());
});

token
  .command("add <registryUrl> <token>")
  .option("--registry")
  .action(async (proxyRegistryUrl, token, options) => {
    const registryUrl = new URL(
      options.registry ?? (await getNpmConfigValue("registry"))
    );
    const registryConfig = await getRegistryConfig(registryUrl);

    registryUrl.pathname = "/api/v1/token";

    const res = await fetch(registryUrl.href, {
      method: "POST",
      headers: {
        authorization: registryConfig._authToken ?? "",
      },
      body: JSON.stringify({ registry: proxyRegistryUrl, token }),
    });

    console.log(res.status);
  });

program.version(version).parse(process.argv);
