import { NpmCommand } from "./npm-command";
import { ParsedUrl } from "./url";

export const buildRequestType = (params: {
  parsedUrl: ParsedUrl;
  npmCommand: NpmCommand | null;
}): RequestType => {
  const { npmCommand, parsedUrl } = params;
  const { apiOwner } = parsedUrl;
  if (npmCommand && apiOwner === "unknown") return RequestType.npmCommand;

  if (apiOwner === "npm") return RequestType.npmApi;

  if (apiOwner === "troc") return RequestType.trocApi;

  return RequestType.unknown;
};

export enum RequestType {
  npmCommand = "npm-command",
  npmApi = "npm-api",
  trocApi = "troc-api",
  unknown = "unknown",
}
