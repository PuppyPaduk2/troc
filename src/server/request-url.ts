export class RequestUrl {
  private _url: string;

  constructor(url?: string) {
    this._url = decodeURIComponent(url ?? "");
  }

  public get value(): string {
    return this._url;
  }

  public get expPkgTarballScope(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.pkgTarballScope);
  }

  public get expPkgTarballName(): RegExpMatchArray | null {
    if (this.expPkgTarballScope) return null;
    return this._url.match(RequestUrl.exps.pkgTarballName);
  }

  public get expNpmWhoami(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.npmWhoami);
  }

  public get expNpmUser(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.npmUser);
  }

  public get expNpmApiV(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.npmApiV);
  }

  public get expNpmApi(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.npmApi);
  }

  public get expTrocApi(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.trocApi);
  }

  public get expPkgScope(): RegExpMatchArray | null {
    return this._url.match(RequestUrl.exps.pkgScope);
  }

  public get expPkgName(): RegExpMatchArray | null {
    if (this.expPkgTarballScope) return null;
    if (this.expPkgTarballName) return null;
    if (this.expNpmWhoami) return null;
    if (this.expNpmUser) return null;
    if (this.expNpmApiV) return null;
    if (this.expNpmApi) return null;
    if (this.expTrocApi) return null;
    if (this.expPkgScope) return null;
    return this._url.match(RequestUrl.exps.pkgName);
  }

  public get registry(): string | null {
    if (this.expPkgTarballScope) return this.expPkgTarballScope[1] ?? null;
    if (this.expPkgTarballName) return this.expPkgTarballName[1] ?? null;
    if (this.expNpmWhoami) return this.expNpmWhoami[1] ?? null;
    if (this.expNpmUser) return this.expNpmUser[1] ?? null;
    if (this.expNpmApiV) return this.expNpmApiV[1] ?? null;
    if (this.expNpmApi) return this.expNpmApi[1] ?? null;
    if (this.expTrocApi) return this.expTrocApi[1] ?? null;
    if (this.expPkgScope) return this.expPkgScope[1] ?? null;
    if (this.expPkgName) return this.expPkgName[1] ?? null;
    return null;
  }

  public get pkgTarballScope(): string | null {
    if (this.expPkgTarballScope) return this.expPkgTarballScope[2] ?? null;
    return null;
  }

  public get pkgTarballName(): string | null {
    if (this.expPkgTarballScope) return this.expPkgTarballScope[3] ?? null;
    if (this.expPkgTarballName) return this.expPkgTarballName[2] ?? null;
    return null;
  }

  public get tarballName(): string | null {
    if (this.expPkgTarballScope) return this.expPkgTarballScope[4] ?? null;
    if (this.expPkgTarballName) return this.expPkgTarballName[3] ?? null;
    return null;
  }

  public get tarballVersion(): string | null {
    if (!this.tarballName) return null;
    if (!this.pkgName) return null;
    return this.tarballName.replace(this.pkgName + "-", "").replace(".tgz", "");
  }

  public get npmApiVersion(): string | null {
    if (this.expNpmWhoami) return "/v1";
    if (this.expNpmUser) return "/v1";
    if (this.expNpmApiV) return this.expNpmApiV[2] ?? null;
    if (this.expNpmApi) return this.expNpmApi[2] ?? null;
    return null;
  }

  public get npmApiPath(): string | null {
    if (this.expNpmWhoami) return "/whoami";
    if (this.expNpmUser) return this.expNpmUser[2] ?? null;
    if (this.expNpmApiV) return this.expNpmApiV[3] ?? null;
    if (this.expNpmApi) return this.expNpmApi[3] ?? null;
    return null;
  }

  public get trocApiVersion(): string | null {
    if (this.expTrocApi) return this.expTrocApi[2] ?? null;
    return null;
  }

  public get trocApiPath(): string | null {
    if (this.expTrocApi) return this.expTrocApi[3] ?? null;
    return null;
  }

  public get pkgScope(): string | null {
    if (this.expPkgTarballScope) return this.expPkgTarballScope[2] ?? null;
    if (this.expNpmApi) return null;
    if (this.expNpmWhoami) return null;
    if (this.expNpmApiV) return null;
    if (this.expPkgScope) return this.expPkgScope[2] ?? null;
    return null;
  }

  public get pkgName(): string | null {
    if (this.expPkgTarballScope) return this.expPkgTarballScope[3] ?? null;
    if (this.expPkgTarballName) return this.expPkgTarballName[2] ?? null;
    if (this.expNpmApi) return null;
    if (this.expNpmWhoami) return null;
    if (this.expNpmApiV) return null;
    if (this.expPkgScope) return this.expPkgScope[3] ?? null;
    if (this.expPkgName) return this.expPkgName[2] ?? null;
    return null;
  }

  static exps = {
    pkgTarballScope:
      /^(.*)(\/@[\w\d_\-.]+)(\/[\w\d_\-.]+)\/-(\/[\w\d_\-.]+\.tgz)$/,
    pkgTarballName: /^(.*)(\/[\w\d_\-.]+)\/-(\/[\w\d_\-.]+\.tgz)$/,
    npmWhoami: /^(.*)\/-\/whoami$/,
    npmUser: /^(.*)\/-(\/user.*)$/,
    npmApiV: /^(.*)\/-(\/v\d+)(\/.*)$/,
    npmApi: /^(.*)\/-\/npm(\/v\d+)(\/.*)$/,
    trocApi: /^(.*)\/-\/troc(\/v\d+)(\/.*)$/,
    pkgScope: /^(.*)(\/@[\w\d_\-.]+)(\/[\w\d_\-.]+)$/,
    pkgName: /^(.*)(\/[\w\d_\-.]+)$/,
  };
}

// "tarball":"https://registry.npmjs.org/string-mask-jedi/-/string-mask-jedi-0.0.1.tgz"
// "tarball":"https://registry.npmjs.org/@evgenyifedotov/p1/-/p1-0.0.1.tgz"
