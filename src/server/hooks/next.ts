import { RegistryHooks } from "../registry";

export const formatPackageInfo: RegistryHooks["formatPackageInfo"] = async (
  info,
  request
) => {
  const host = request.headers.host;

  // Change tarball to current host
  Object.entries(info.versions).forEach(([, info]) => {
    const tarball: string = info.dist.tarball;
    const parsedTarball: URL = new URL(tarball);

    parsedTarball.host = host || parsedTarball.host;
    info.dist.tarball = parsedTarball.href;
  });

  return info;
};
