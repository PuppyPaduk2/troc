import * as path from "path";
import { checkService } from "../utils/request";

export type ServerConfig = {
  proxyScopeUrls: Record<string, string[]>;
  proxyCommandUrls: Record<string, string[]>;
  proxyAllUrls: string[];
  storageDir: string;
};

export type ServerEnvs = {
  storageDir: string;
  packagesFolder: string;
  proxyFolder: string;
  registryFolder: string;
  packageInfoName: string;
  tokensName: string;
};

const storageDir = path.join(__dirname, "storage");

export class Config {
  public serverConfig: ServerConfig = {
    proxyScopeUrls: {},
    proxyCommandUrls: {},
    proxyAllUrls: [],
    storageDir,
  };
  public serverEnvs: ServerEnvs = {
    packagesFolder: "packages",
    proxyFolder: "proxy",
    registryFolder: "registry",
    packageInfoName: "info.json",
    tokensName: "tokens.json",
    storageDir,
  };

  constructor(
    serverConfig: Partial<ServerConfig> = {},
    serverEnvs: Partial<ServerEnvs> = {}
  ) {
    this.serverConfig = { ...this.serverConfig, ...serverConfig };
    this.serverEnvs = { ...this.serverEnvs, ...serverEnvs };
  }

  public get storageDir() {
    return this.serverConfig.storageDir ?? this.serverEnvs.storageDir;
  }

  // TODO remove
  public get proxyFolder() {
    return this.serverEnvs.proxyFolder;
  }

  // TODO remove
  public get packagesFolder() {
    return this.serverEnvs.packagesFolder;
  }

  // TODO remove
  public get registryFolder() {
    return this.serverEnvs.registryFolder;
  }

  // TODO remove
  public get packageInfoName() {
    return this.serverEnvs.packageInfoName;
  }

  // TODO remove
  public get proxyUrls() {
    return {
      scope: this.serverConfig.proxyScopeUrls,
      command: this.serverConfig.proxyCommandUrls,
      all: this.serverConfig.proxyAllUrls,
    };
  }

  public async checkProxyUrls() {
    const checkedUrls = new Set<string>();
    const correctUrls = new Set<string>();
    const proxyUrls: Pick<
      ServerConfig,
      "proxyScopeUrls" | "proxyCommandUrls" | "proxyAllUrls"
    > = {
      proxyScopeUrls: {},
      proxyCommandUrls: {},
      proxyAllUrls: [],
    };

    const checkUrls = async (urls: string[]) => {
      const nextUrls = new Set<string>();

      for (const url of urls) {
        if (!checkedUrls.has(url)) {
          checkedUrls.add(url);

          const result = await checkService(url);

          if (result === null) {
            correctUrls.add(url);
            nextUrls.add(url);
          }
        } else if (correctUrls.has(url)) {
          nextUrls.add(url);
        }
      }

      return nextUrls;
    };

    // proxyScopeUrls
    for (const [key, urls] of Object.entries(
      this.serverConfig.proxyScopeUrls
    )) {
      const nextUrls = await checkUrls(urls);

      if (nextUrls.size) {
        proxyUrls.proxyScopeUrls[key] = Array.from(nextUrls);
      }
    }

    // proxyCommandUrls
    for (const [key, urls] of Object.entries(
      this.serverConfig.proxyCommandUrls
    )) {
      const nextUrls = await checkUrls(urls);

      if (nextUrls.size) {
        proxyUrls.proxyCommandUrls[key] = Array.from(nextUrls);
      }
    }

    // proxyAllUrls
    const nextUrls = await checkUrls(this.serverConfig.proxyAllUrls);

    if (nextUrls.size) {
      proxyUrls.proxyAllUrls = Array.from(nextUrls);
    }

    this.serverConfig = {
      ...this.serverConfig,
      ...proxyUrls,
    };
  }
}
