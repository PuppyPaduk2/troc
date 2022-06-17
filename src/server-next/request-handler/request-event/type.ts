import { ParsedUrl } from "../../../utils/url";
import { NpmCommand } from "./npm-command";

export enum Type {
  npmCommand = "npm-command",
  npmApi = "npm-api",
  trocApi = "troc-api",
  unknown = "unknown",
}

export const buildType = (params: {
  parsedUrl: ParsedUrl;
  npmCommand: NpmCommand | null;
}): Type => {
  const { npmCommand, parsedUrl } = params;
  const { apiOwner } = parsedUrl;
  if (npmCommand && apiOwner === "unknown") return Type.npmCommand;

  if (apiOwner === "npm") return Type.npmApi;

  if (apiOwner === "troc") return Type.trocApi;

  return Type.unknown;
};
