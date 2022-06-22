import { NpmCommand, parseNpmCommand } from "./npm-command";
import { PkgPath } from "./pkg-path";
import { Registry } from "./registry";
import { RequestKey } from "./request-key";
import { ParsedUrl, parseUrl } from "./url";

export class RequestEvent {
  parsedUrl: ParsedUrl;
  registry: Registry;
  npmCommand: NpmCommand | null;
  key: RequestKey;
  pkgPath: PkgPath;

  constructor(params: RequestEventParams = {}) {
    this.parsedUrl = parseUrl(params.url);
    this.registry = this._findRegistry(params.registries ?? []);
    this.npmCommand = parseNpmCommand(params.referer);
    this.key = new RequestKey(
      RequestKey.buildParams({
        registry: this.registry,
        npmCommand: this.npmCommand,
        parsedUrl: this.parsedUrl,
      })
    );
    this.pkgPath = new PkgPath({
      baseDir: this.registry.dir,
      basePathnameDir: this.registry.path,
      pkgScope: this.parsedUrl.pkgScope,
      pkgName: this.parsedUrl.pkgName,
      tarballVersion: this.parsedUrl.tarballVersion,
    });
  }

  private _findRegistry(registries: Registry[]): Registry {
    const registry = RequestEvent.findRegistry(registries, this.parsedUrl);
    if (!registry) throw new Error("Registry didn't find");
    return registry;
  }

  static findRegistry(
    registries: Registry[],
    parsedUrl: ParsedUrl
  ): Registry | null {
    const findRegistry = Registry.match.bind(null, parsedUrl.registryPath);
    return registries.find(findRegistry) ?? null;
  }

  static create(params: RequestEventParams): RequestEvent | null {
    try {
      return new RequestEvent(params);
    } catch {
      return null;
    }
  }
}

type RequestEventParams = {
  url?: string;
  referer?: string;
  registries?: Registry[];
};
