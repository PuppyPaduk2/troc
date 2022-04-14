export type NpmResponse = {
  error?: string;
};

export type PackageInfo = NpmResponse & {
  versions: Record<string, PackageVersion>;
  _attachments: Record<string, { data: string }>;
};

export type PackageVersion = {
  dist: PackageDist;
};

export type PackageDist = {
  shasum: string;
  tarball: string;
};

export function changeHostPackageInfo(
  info: PackageInfo,
  host?: string
): PackageInfo {
  // Change tarball to current host
  Object.entries(info.versions).forEach(([, info]) => {
    const tarball: string = info.dist.tarball;
    const parsedTarball: URL = new URL(tarball);

    parsedTarball.host = host || parsedTarball.host;
    info.dist.tarball = parsedTarball.href;
  });

  return info;
}
