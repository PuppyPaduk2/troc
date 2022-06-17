import { PkgPath } from "../../../../utils/pkg-path";

export const getPkgTarballUrl = (
  pkgPath: PkgPath,
  tarball: string,
  host?: string
): string => {
  const distTarballURL = new URL(tarball);
  distTarballURL.host = host ?? distTarballURL.host;
  distTarballURL.pathname = pkgPath.tarballPathname;
  return distTarballURL.href;
};
