import { NpmCommand } from "./npm-command";
import { PkgPath } from "./pkg-path";
import { Registry } from "./registry";
import { RequestKey } from "./request-key";
import { ParsedUrl } from "./url";

export class RequestEvent {
  parsedUrl: ParsedUrl;
  registry: Registry;
  npmCommand: NpmCommand | null;
  key: RequestKey;
  pkgPath: PkgPath;

  constructor(params: RequestEventParams) {
    this.parsedUrl = params.parsedUrl;
    this.registry = params.registry;
    this.npmCommand = params.npmCommand;
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

  static findRegistry(
    registries: Registry[],
    parsedUrl: ParsedUrl
  ): Registry | null {
    const findRegistry = Registry.match.bind(null, parsedUrl.registryPath);
    return registries.find(findRegistry) ?? null;
  }
}

type RequestEventParams = {
  parsedUrl: ParsedUrl;
  registry: Registry;
  npmCommand: NpmCommand | null;
};
