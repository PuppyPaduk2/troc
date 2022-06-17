import { ParsedUrl } from "../../../utils/url";
import { NpmCommand } from "./npm-command";

export enum PkgAction {
  getInfo = "get-info",
  getTarball = "get-tarball",
  unknown = "unknown",
}

export const buildPkgAction = (params: {
  npmCommand: NpmCommand | null;
  parsedUrl: ParsedUrl;
}): PkgAction => {
  const { npmCommand, parsedUrl } = params;
  if (!npmCommand) return PkgAction.unknown;

  if (npmCommand === NpmCommand.publish) return PkgAction.unknown;

  const { tarballVersion } = parsedUrl;
  if (tarballVersion) return PkgAction.getTarball;

  return PkgAction.getInfo;
};
