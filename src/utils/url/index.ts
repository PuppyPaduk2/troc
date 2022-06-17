import { ExpKeys, exps } from "./exps";

export type ParsedUrl = {
  origin: string;
  registryPath: string;
  pkgScope: string;
  pkgName: string;
  tarballVersion: string;
  apiOwner: ApiOwner;
  apiVersion: string;
  apiPath: string;
};

export type ApiOwner = "npm" | "troc" | "unknown";

export const parseUrl = (url?: string): ParsedUrl => {
  const origin = decodeURIComponent(url ?? "");
  const matchedUrl = matchUrl(origin);
  return {
    origin,
    registryPath: getRegistryPath(matchedUrl),
    pkgScope: getPkgScope(matchedUrl),
    pkgName: getPkgName(matchedUrl),
    tarballVersion: getTarballVersion(matchedUrl),
    apiOwner: getApiOwner(matchedUrl),
    apiVersion: getApiVersion(matchedUrl),
    apiPath: getApiPath(matchedUrl),
  };
};

type MatchedUrl = Record<ExpKeys, RegExpMatchArray | null>;

const matchUrl = (url?: string): MatchedUrl => ({
  pkgTarballScope: url?.match(exps.pkgTarballScope) ?? null,
  pkgTarballName: url?.match(exps.pkgTarballName) ?? null,
  npmApiUser: url?.match(exps.npmApiUser) ?? null,
  npmApiV: url?.match(exps.npmApiV) ?? null,
  npmApi: url?.match(exps.npmApi) ?? null,
  trocApi: url?.match(exps.trocApi) ?? null,
  pkgScope: url?.match(exps.pkgScope) ?? null,
  pkgName: url?.match(exps.pkgName) ?? null,
});

type GetUrlProp = (matchedUrl: MatchedUrl) => string;

const getRegistryPath: GetUrlProp = (matchedUrl) => {
  if (matchedUrl.pkgTarballScope) return matchedUrl.pkgTarballScope[1] ?? "";
  if (matchedUrl.pkgTarballName) return matchedUrl.pkgTarballName[1] ?? "";
  if (matchedUrl.npmApiUser) return matchedUrl.npmApiUser[1] ?? "";
  if (matchedUrl.npmApiV) return matchedUrl.npmApiV[1] ?? "";
  if (matchedUrl.npmApi) return matchedUrl.npmApi[1] ?? "";
  if (matchedUrl.trocApi) return matchedUrl.trocApi[1] ?? "";
  if (matchedUrl.pkgScope) return matchedUrl.pkgScope[1] ?? "";
  if (matchedUrl.pkgName) return matchedUrl.pkgName[1] ?? "";
  return "";
};

const getPkgScope: GetUrlProp = (matchedUrl) => {
  if (matchedUrl.pkgTarballScope) return matchedUrl.pkgTarballScope[2] ?? "";
  if (matchedUrl.npmApiUser) return "";
  if (matchedUrl.npmApiV) return "";
  if (matchedUrl.npmApi) return "";
  if (matchedUrl.trocApi) return "";
  if (matchedUrl.pkgScope) return matchedUrl.pkgScope[2] ?? "";
  return "";
};

const getPkgName: GetUrlProp = (matchedUrl) => {
  if (matchedUrl.pkgTarballScope) return matchedUrl.pkgTarballScope[3] ?? "";
  if (matchedUrl.pkgTarballName) return matchedUrl.pkgTarballName[2] ?? "";
  if (matchedUrl.npmApiUser) return "";
  if (matchedUrl.npmApiV) return "";
  if (matchedUrl.npmApi) return "";
  if (matchedUrl.trocApi) return "";
  if (matchedUrl.pkgScope) return matchedUrl.pkgScope[3] ?? "";
  if (matchedUrl.pkgName) return matchedUrl.pkgName[2] ?? "";
  return "";
};

const getTarballVersion: GetUrlProp = (matchedUrl) => {
  const tarballName = getTarballName(matchedUrl);
  const pkgName = getPkgName(matchedUrl);
  if (!tarballName || !pkgName) return "";

  return tarballName.replace(pkgName + "-", "").replace(".tgz", "");
};

const getTarballName: GetUrlProp = (matchedUrl) => {
  if (matchedUrl.pkgTarballScope) return matchedUrl.pkgTarballScope[4] ?? "";
  if (matchedUrl.pkgTarballName) return matchedUrl.pkgTarballName[3] ?? "";
  return "";
};

const getApiOwner = (matchedUrl: MatchedUrl): ApiOwner => {
  if (matchedUrl.npmApiUser) return "npm";
  if (matchedUrl.npmApiV) return "npm";
  if (matchedUrl.npmApi) return "npm";
  if (matchedUrl.trocApi) return "troc";
  return "unknown";
};

const getApiVersion: GetUrlProp = (matchedUrl) => {
  if (matchedUrl.npmApiUser) return "";
  if (matchedUrl.npmApiV) return matchedUrl.npmApiV[2] ?? "";
  if (matchedUrl.npmApi) return matchedUrl.npmApi[2] ?? "";
  if (matchedUrl.trocApi) return matchedUrl.trocApi[2] ?? "";
  return "";
};

const getApiPath: GetUrlProp = (matchedUrl) => {
  if (matchedUrl.npmApiUser) return matchedUrl.npmApiUser[2] ?? "";
  if (matchedUrl.npmApiV) return matchedUrl.npmApiV[3] ?? "";
  if (matchedUrl.npmApi) return matchedUrl.npmApi[3] ?? "";
  if (matchedUrl.trocApi) return matchedUrl.trocApi[3] ?? "";
  return "";
};
