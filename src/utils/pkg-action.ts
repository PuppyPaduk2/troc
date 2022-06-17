import { NpmCommand } from "./npm-command";
import { ParsedUrl } from "./url";

export const buildPkgAction = (params: {
  parsedUrl: ParsedUrl;
  npmCommand: NpmCommand | null;
}): PkgAction => {
  const { npmCommand, parsedUrl } = params;
  if (!npmCommand) return PkgAction.unknown;

  if (npmCommand === NpmCommand.publish) return PkgAction.unknown;

  const { tarballVersion } = parsedUrl;
  if (tarballVersion) return PkgAction.getTarball;

  return PkgAction.getInfo;
};

export enum PkgAction {
  getInfo = "get-info",
  getTarball = "get-tarball",
  unknown = "unknown",
}
