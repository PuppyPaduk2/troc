import { program } from "commander";

import { version } from "../../../package.json";
import { getNpmConfigValue } from "../../utils/npm";
import { fetch, Response } from "../../utils/fetch";

// Registry
const registryCommands = program.command("registry");

registryCommands.description("Commands for registry server");

registryCommands
  .command("signup <username> <password> <email>")
  .action(async (username, password, email) => {
    const href = await getFetchHref("/api/v1/signup");
    const res = await fetch(href, {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    });

    if (isSuccessful(res)) {
      console.log("Signup success");
    } else {
      console.log("Signup failure");
    }
  });

// Proxy
const proxyCommands = program.command("proxy");

proxyCommands.description("Commands for proxy server");

program.version(version).parse(process.argv);

// Utils
async function getNpmRegistryUrl(registry?: string): Promise<URL> {
  if (registry) return new URL(registry);
  return new URL(await getNpmConfigValue("registry"));
}

async function getFetchHref(
  pathname: string,
  registry?: string
): Promise<string> {
  const registryUrl = await getNpmRegistryUrl(registry);

  registryUrl.pathname = pathname;
  return registryUrl.href;
}

function isSuccessful(res: Response): boolean {
  return res.status >= 200 && res.status < 300;
}
