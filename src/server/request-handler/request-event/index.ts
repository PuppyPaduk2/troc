import * as http from "http";

import { parseNpmCommand } from "../../../utils/npm-command";
import { PkgPath } from "../../../utils/pkg-path";
import { findRegistry, Registry } from "../../../utils/registry";
import { NpmCommand, RequestKey } from "../../../utils/request-key";
import { ParsedUrl } from "../../../utils/url";

type GetRequestEventOptions = {
  registries: Registry[];
};

export type RequestEvent = {
  parsedUrl: ParsedUrl;
  registry: Registry;
  key: RequestKey;
  npmCommand: NpmCommand | null;
  pkgPath: PkgPath;
};

export const getRequestEvent = (
  request: http.IncomingMessage,
  parsedUrl: ParsedUrl,
  options: GetRequestEventOptions
): RequestEvent | Error => {
  const { registries } = options;
  const registry = findRegistry(registries, parsedUrl.registryPath);
  if (!registry) return new Error("Registry doesn't exist");

  const npmCommand = parseNpmCommand(request.headers.referer);
  const key = new RequestKey(
    RequestKey.buildParams({
      parsedUrl,
      registry,
      npmCommand,
    })
  );
  const pkgPath = new PkgPath({
    baseDir: registry.dir,
    basePathnameDir: registry.path,
    pkgScope: parsedUrl.pkgScope,
    pkgName: parsedUrl.pkgName,
    tarballVersion: parsedUrl.tarballVersion,
  });
  return { parsedUrl, registry, key, npmCommand, pkgPath };
};
