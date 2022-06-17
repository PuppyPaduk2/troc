export const exps = {
  pkgTarballScope:
    /^(.*)(\/@[\w\d_\-.]+)(\/[\w\d_\-.]+)\/-(\/[\w\d_\-.]+\.tgz)$/,
  pkgTarballName: /^(.*)(\/[\w\d_\-.]+)\/-(\/[\w\d_\-.]+\.tgz)$/,
  npmApiUser: /^(.*)\/-(\/user.*)$/,
  npmApiV: /^(.*)\/-(\/v\d+)(\/.*)$/,
  npmApi: /^(.*)\/-\/npm(\/v\d+)(\/.*)$/,
  trocApi: /^(.*)\/-\/troc(\/v\d+)(\/.*)$/,
  pkgScope: /^(.*)(\/@[\w\d_\-.]+)(\/[\w\d_\-.]+)$/,
  pkgName: /^(.*)(\/[\w\d_\-.]+)$/,
};

export type Exps = typeof exps;
export type ExpKeys = keyof Exps;
