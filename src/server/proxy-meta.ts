import { Pkg } from "./request-meta";

export type ProxyConfig = {
  url: string;
  names?: string[];
  scopes?: string[];
  commands?: string[];
  exclude?: {
    names?: string[];
    scopes?: string[];
    commands?: string[];
  };
};

export class ProxyMeta {
  private proxyConfigs: ProxyConfig[] = [];

  constructor(proxyConfigs?: ProxyConfig[]) {
    this.proxyConfigs = proxyConfigs ?? this.proxyConfigs;
  }

  public getUrls({ pkg, command }: { pkg: Pkg; command: string }): string[] {
    const { scope, name } = pkg;
    const filteredUrls: string[] = [];

    for (const config of this.proxyConfigs) {
      if (
        !config.exclude?.scopes?.includes(scope) &&
        !config.exclude?.names?.includes(name) &&
        !config.exclude?.commands?.includes(command)
      ) {
        const { scopes = [], names = [], commands = [] } = config;

        const isAnyScope = !scopes.length;
        const isScope = Boolean(scopes.includes(scope)) || isAnyScope;

        const isAnyName = !names.length;
        const isName = Boolean(names.includes(name)) || isAnyName;

        const isAnyCommand = !commands.length;
        const isCommand = Boolean(commands.includes(command)) || isAnyCommand;

        const isAll = isAnyName && isAnyScope && isAnyCommand;

        if ((isName && isScope && isCommand) || isAll) {
          filteredUrls.push(config.url);
        }
      }
    }

    return Array.from(new Set(filteredUrls));
  }
}
