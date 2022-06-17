import { NpmCommand } from "./npm-command";
import { ParsedUrl } from "./url";

export enum Type {
  npmCommand = "npm-command",
  npmApi = "npm-api",
  trocApi = "troc-api",
  unknown = "unknown",
}

export const buildType = (params: {
  npmCommand: NpmCommand | null;
  parsedUrl: ParsedUrl;
}): Type => {
  const { npmCommand, parsedUrl } = params;
  const { apiOwner } = parsedUrl;
  if (npmCommand && apiOwner === "unknown") return Type.npmCommand;

  if (apiOwner === "npm") return Type.npmApi;

  if (apiOwner === "troc") return Type.trocApi;

  return Type.unknown;
};
