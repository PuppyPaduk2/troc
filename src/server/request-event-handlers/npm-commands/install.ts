import {
  accessSoft,
  readFileSoft,
  writeBase64,
  writeFile,
} from "../../../utils/fs";
import { NpmPackageInfoInstall } from "../../../utils/npm";
import {
  getIncomingMessageData,
  getIncomingMessageJson,
} from "../../../utils/request";
import {
  NpmCommand,
  PkgAction,
  RegistryType,
  RequestKey,
  RequestType,
} from "../../../utils/request-key";
import { attachResponse } from "../../../utils/response";
import { RequestEventHandler, RequestEventHandlers } from "../types";
import { getPkgTarballUrl } from "./utils/pkg";
import { redirectNpmRequest } from "./utils/request";

const installKey = new RequestKey({
  requestType: RequestType.npmCommand,
  npmCommand: NpmCommand.install,
});
const proxyInfoKey = installKey.fork({
  registryType: RegistryType.proxy,
  pkgAction: PkgAction.getInfo,
});
const proxyTarballKey = installKey.fork({
  registryType: RegistryType.proxy,
  pkgAction: PkgAction.getTarball,
});
const localInfoKey = installKey.fork({
  registryType: RegistryType.local,
  pkgAction: PkgAction.getInfo,
});
const localTarballKey = installKey.fork({
  registryType: RegistryType.local,
  pkgAction: PkgAction.getTarball,
});

const proxyInfoHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);
  const local = localInfoHandler.bind(null, params);
  const redirectResult = await redirectNpmRequest(event, payload.request);
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
      payload.request.headers.host
    );
  });
  const end = JSON.stringify(data, null, 2);
  await writeFile(event.pkgPath.info, end);
  return send.ok.bind(null, { end });
};

const proxyTarballHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);
  const local = localTarballHandler.bind(null, params);

  const redirectResult = await redirectNpmRequest(event, payload.request);
  if (redirectResult instanceof Error) return local;

  if (!redirectResult.res) return local;

  const { statusCode } = redirectResult.res;
  if (statusCode !== 200) return local;

  const end = await getIncomingMessageData(redirectResult.res);
  await writeBase64(event.pkgPath.tarball, end);
  return send.ok.bind(null, { end });
};

const localInfoHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);
  if (!(await accessSoft(event.pkgPath.info))) return send.notFound;

  const end = await readFileSoft(event.pkgPath.info);
  return send.ok.bind(null, { end });
};

const localTarballHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);
  if (!(await accessSoft(event.pkgPath.tarball))) return send.notFound;

  const end = await readFileSoft(event.pkgPath.tarball);
  return send.ok.bind(null, { end });
};

export const installHandlers: RequestEventHandlers = {
  [proxyInfoKey.value]: proxyInfoHandler,
  [proxyTarballKey.value]: proxyTarballHandler,
  [localInfoKey.value]: localInfoHandler,
  [localTarballKey.value]: localTarballHandler,
};
