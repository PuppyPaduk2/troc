import { program } from "commander";
import * as path from "path";

import { version } from "../../package.json";
import { fetch, Response } from "../utils/fetch";
import { getNpmConfigValue, getRegistryConfig } from "../utils/npm";

program
  .command("signup <name> <password> <email>")
  .description("Signup to registry on troc-server")
  .option("--registry <registryUrl>", "Registry url")
  .action(async (name, password, email, { registry }) => {
    const href = await getFetchHref("/v1/signup", registry);
    const res = await fetch(href, {
      method: "POST",
      body: JSON.stringify({ name, password, email }),
    });

    if (isSuccessful(res)) {
      console.log("Signup success");
    } else {
      console.log("Signup failure");
    }
  });

program
  .command("attach-token <targetRegistryUrl>")
  .description("Attach token to proxy server for work with proxy services")
  .option("--registry <registryUrl>", "Registry url")
  .action(async (targetRegistryUrl, { registry }) => {
    const { _authToken } = await getRegistryConfig(targetRegistryUrl);

    if (!_authToken) {
      console.log("Please login to", targetRegistryUrl, "through `npm login`");
      return;
    }

    const registryUrl = await getNpmRegistryUrl(registry);
    const href = await getFetchHref("/v1/attach-token", registryUrl.href);
    const configRegistry = await getRegistryConfig(registryUrl.href);
    const res = await fetch(href, {
      method: "POST",
      headers: {
        authorization: configRegistry._authToken ?? "",
      },
      body: JSON.stringify({
        registryUrl: targetRegistryUrl,
        token: _authToken,
      }),
    });

    if (isSuccessful(res)) {
      console.log("Attaching token success");
    } else {
      console.log("Attaching token failure", res.status);
    }
  });

program.version(version).parse(process.argv);

// Utils
async function getFetchHref(
  pathname: string,
  registry?: string
): Promise<string> {
  const registryUrl = await getNpmRegistryUrl(registry);

  registryUrl.pathname = path.join(registryUrl.pathname, "/-/troc", pathname);
  return registryUrl.href;
}

async function getNpmRegistryUrl(registry?: string): Promise<URL> {
  if (registry) return new URL(registry);
  return new URL(await getNpmConfigValue("registry"));
}

function isSuccessful(res: Response): boolean {
  return res.status >= 200 && res.status < 300;
}
