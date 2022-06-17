import * as http from "http";

import { PkgPath } from "../../../utils/pkg-path";
import {
  findRegistry,
  getRegistryType,
  Registry,
} from "../../../utils/registry";
import { ParsedUrl } from "../../../utils/url";
import { parseApiPath } from "./api-path";
import { parseApiVersion } from "./api-version";
import { RequestKey } from "./key";
import { parseNpmCommand } from "./npm-command";
import { buildPkgAction } from "./pkg-action";
import { buildType } from "./type";

type GetRequestEventOptions = {
  registries: Registry[];
};

export type RequestEvent = {
  parsedUrl: ParsedUrl;
  registry: Registry;
  key: RequestKey;
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

  const registryType = getRegistryType(registry);
  const npmCommand = parseNpmCommand(request.headers.referer);
  const type = buildType({ parsedUrl, npmCommand });
  const pkgAction = buildPkgAction({ npmCommand, parsedUrl });
  const apiVersion = parseApiVersion(parsedUrl.apiVersion);
  const apiPath = parseApiPath(parsedUrl.apiPath);
  const key = new RequestKey({
    registryType,
    type,
    npmCommand,
    pkgAction,
    apiVersion,
    apiPath,
  });
  const pkgPath = new PkgPath({
    baseDir: registry.dir,
    basePathnameDir: registry.path,
    pkgScope: parsedUrl.pkgScope,
    pkgName: parsedUrl.pkgName,
    tarballVersion: parsedUrl.tarballVersion,
  });
  return { parsedUrl, registry, key, pkgPath };
};
