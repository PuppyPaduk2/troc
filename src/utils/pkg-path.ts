import * as path from "path";

type PkgPathParams = {
  baseDir?: string;
  basePathnameDir?: string;
  pkgsFolder?: string;
  pkgScope?: string;
  pkgName?: string;
  tarballFolder?: string;
  tarballVersion?: string;
  fileName?: string;
};

export class PkgPath {
  baseDir = "";
  basePathnameDir = "";
  pkgsFolder = PkgPath.pkgsFolder;
  pkgScope = "";
  pkgName = "";
  tarballFolder = PkgPath.tarballFolder;
  tarballVersion = "";
  fileName = "";

  constructor(params: PkgPathParams) {
    this.baseDir = params.baseDir ?? this.baseDir;
    this.basePathnameDir = params.basePathnameDir ?? this.basePathnameDir;
    this.pkgsFolder = params.pkgsFolder ?? this.pkgsFolder;
    this.pkgScope = params.pkgScope ?? this.pkgScope;
    this.pkgName = params.pkgName ?? this.pkgName;
    this.tarballFolder = params.tarballFolder ?? this.tarballFolder;
    this.tarballVersion = params.tarballVersion ?? this.tarballVersion;
    this.fileName = params.fileName ?? this.fileName;
  }

  get tarballPathname(): string {
    return path.join(
      this.pathnameDir,
      PkgPath.tarballFolder,
      this.tarballFileName
    );
  }

  get pathnameDir(): string {
    return path.join(this.basePathnameDir, this.pkgScope, this.pkgName);
  }

  get tarballKey(): string {
    if (!this.tarballFileName) return "";

    return path.join(this.pkgScope, this.tarballFileName).replace(/^\//, "");
  }

  get tarball(): string {
    if (!this.tarballFileName) return "";

    return path.join(this.tarballDir, this.tarballFileName);
  }

  get tarballDir(): string {
    return path.join(this.dir, this.tarballFolder);
  }

  get tarballFileName(): string {
    if (!this.pkgName || !this.tarballVersion) return "";

    return this.pkgName + "-" + this.tarballVersion + ".tgz";
  }

  get info(): string {
    return path.join(this.dir, PkgPath.infoFileName);
  }

  get dir(): string {
    return path.join(
      this.baseDir,
      this.pkgsFolder,
      this.pkgScope,
      this.pkgName
    );
  }

  fork(params: PkgPathParams): PkgPath {
    return new PkgPath({ ...this, ...params });
  }

  static pkgsFolder = "packages";
  static tarballFolder = "-";
  static infoFileName = "info.json";
}
