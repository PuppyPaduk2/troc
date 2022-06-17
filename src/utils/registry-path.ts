// import * as path from "path";

// const pkgsFolder = "packages";
// const tarballFolder = "-";
// const infoFile = "info.json";

// export const getPkgTarballPathname = (params: PkgPathParams): string => {
//   return getPkgTarball({
//     pkgsFolder: "",
//     ...params,
//   });
// };

// export const getPkgDir = (params: PkgPathParams): string => {
//   return getPkgPath({
//     pkgNameFolder: params.pkgNameFolder ?? params.pkgName ?? "",
//     pkgsFolder,
//     ...params,
//   });
// };

// export const getPkgInfo = (params: PkgPathParams): string => {
//   return getPkgPath({
//     pkgNameFolder: params.pkgNameFolder ?? params.pkgName ?? "",
//     fileName: infoFile,
//     pkgsFolder,
//     ...params,
//   });
// };

// export const getPkgTarballDir = (params: PkgPathParams): string => {
//   return getPkgPath({
//     pkgNameFolder: params.pkgNameFolder ?? params.pkgName ?? "",
//     pkgsFolder,
//     tarballFolder,
//     ...params,
//   });
// };

// export const getPkgTarball = (params: PkgPathParams): string => {
//   const { pkgName = "", tarballVersion = "" } = params;
//   return getPkgPath({
//     pkgNameFolder: params.pkgNameFolder ?? params.pkgName ?? "",
//     fileName: pkgName + "-" + tarballVersion + ".tgz",
//     pkgsFolder,
//     tarballFolder,
//     ...params,
//   });
// };

// export const getPkgPath = (params: PkgPathParams): string => {
//   const pathParams = buildPkgPathParams(params);
//   return path.join(
//     pathParams.dir,
//     pathParams.pkgsFolder,
//     pathParams.pkgScope,
//     pathParams.pkgNameFolder,
//     pathParams.tarballFolder,
//     pathParams.fileName
//   );
// };

// export const buildPkgPathParams = (
//   params: PkgPathParams
// ): Required<PkgPathParams> => ({
//   dir: params.dir ?? "",
//   pkgsFolder: params.pkgsFolder ?? "",
//   pkgScope: params.pkgScope ?? "",
//   pkgNameFolder: params.pkgNameFolder ?? "",
//   pkgName: params.pkgName ?? "",
//   tarballVersion: params.tarballVersion ?? "",
//   tarballFolder: params.tarballFolder ?? "",
//   fileName: params.fileName ?? "",
// });

// export type PkgPathParams = {
//   dir?: string;
//   pkgsFolder?: string;
//   pkgScope?: string;
//   pkgNameFolder?: string;
//   pkgName?: string;
//   tarballVersion?: string;
//   tarballFolder?: string;
//   fileName?: string;
// };
