import {
  accessSoft,
  readFileSoft,
  writeBase64,
  writeFile,
} from "../../../../utils/fs";
import { NpmPackageInfoInstall } from "../../../../utils/npm";
import {
  getIncomingMessageData,
  getIncomingMessageJson,
} from "../../../../utils/request";
import {
  NpmCommand,
  PkgAction,
  RegistryType,
  RequestKey,
  RequestType,
} from "../../../../utils/request-key";
import { attachResponse } from "../../../../utils/response";
import { RequestEventHandler, RequestEventHandlers } from "../types";
import { getPkgTarballUrl } from "../utils/pkg";
import { redirectNpmRequest } from "../utils/request";

const installKey = new RequestKey({
  requestType: RequestType.npmCommand,
  npmCommand: NpmCommand.install,
});
const localInfoKey = installKey.fork({
  registryType: RegistryType.local,
  pkgAction: PkgAction.getInfo,
});
const localTarballKey = installKey.fork({
  registryType: RegistryType.local,
  pkgAction: PkgAction.getTarball,
});
const proxyInfoKey = installKey.fork({
  registryType: RegistryType.proxy,
  pkgAction: PkgAction.getInfo,
});
const proxyTarballKey = installKey.fork({
  registryType: RegistryType.proxy,
  pkgAction: PkgAction.getTarball,
});

const proxyInfoHandler: RequestEventHandler = async (event, params) => {
  const send = attachResponse(params.response);
  const local = localInfoHandler.bind(null, event, params);
  const redirectResult = await redirectNpmRequest(event, params.request);
  if (redirectResult instanceof Error) return local;

  const { res } = redirectResult;
  if (!res) return local;

  const { statusCode } = res;
  if (statusCode !== 200) return local;

  const data = await getIncomingMessageJson<NpmPackageInfoInstall>(res);
  if (!data) return send.badRequest;

  Object.values(data.versions).forEach((pkgVersion) => {
    pkgVersion.dist.tarball = getPkgTarballUrl(
      event.pkgPath.fork({ tarballVersion: pkgVersion.version }),
      pkgVersion.dist.tarball,
      params.request.headers.host
    );
  });
  const end = JSON.stringify(data, null, 2);
  await writeFile(event.pkgPath.info, end);
  return send.ok.bind(null, { end });
};

const proxyTarballHandler: RequestEventHandler = async (event, params) => {
  const send = attachResponse(params.response);
  const local = localTarballHandler.bind(null, event, params);

  const redirectResult = await redirectNpmRequest(event, params.request);
  if (redirectResult instanceof Error) return local;

  if (!redirectResult.res) return local;

  const { statusCode } = redirectResult.res;
  if (statusCode !== 200) return local;

  const end = await getIncomingMessageData(redirectResult.res);
  await writeBase64(event.pkgPath.tarball, end);
  return send.ok.bind(null, { end });
};

const localInfoHandler: RequestEventHandler = async (event, params) => {
  const send = attachResponse(params.response);
  if (!(await accessSoft(event.pkgPath.info))) return send.notFound;

  const end = await readFileSoft(event.pkgPath.info);
  return send.ok.bind(null, { end });
};

const localTarballHandler: RequestEventHandler = async (event, params) => {
  const send = attachResponse(params.response);
  if (!(await accessSoft(event.pkgPath.tarball))) return send.notFound;

  const end = await readFileSoft(event.pkgPath.tarball);
  return send.ok.bind(null, { end });
};

export const installHandlers: RequestEventHandlers = {
  [localInfoKey.value]: localInfoHandler,
  [localTarballKey.value]: localTarballHandler,
  [proxyInfoKey.value]: proxyInfoHandler,
  [proxyTarballKey.value]: proxyTarballHandler,
};
