// import { accessSoft, mkdir, readFileSoft, writeBase64, writeFile } from "./fs";
// import { PkgPath } from "./pkg-path";

// export const accessPkgInfo = async (pkgPath: PkgPath): Promise<boolean> => {
//   return await accessSoft(pkgPath.info);
// };

// export const readPkgInfo = async (pkgPath: PkgPath): Promise<Buffer> => {
//   return await readFileSoft(pkgPath.info);
// };

// export const writePkgInfo = async (
//   pkgPath: PkgPath,
//   data: Buffer | string
// ): Promise<void> => {
//   return await writeFile(pkgPath.info, data);
// };

// export const accessPkgTarball = async (
//   params: PkgPathParams
// ): Promise<boolean> => {
//   return await accessSoft(getPkgTarball(params));
// };

// export const writePkgTarball = async (
//   params: WritePkgTarballParams
// ): Promise<void> => {
//   await mkdir(getPkgTarballDir(params));
//   return await writeBase64(getPkgTarball(params), params.data);
// };

// type WritePkgTarballParams = PkgPathParams & { data: Buffer | string };

// export const readPkgTarball = async (
//   params: PkgPathParams
// ): Promise<Buffer> => {
//   return await readFileSoft(getPkgTarball(params));
// };
