import { accessSoft, readFileSoft, writeFile } from "../../../utils/fs";
import { NpmPackageInfoInstall } from "../../../utils/npm";
import { getIncomingMessageJson } from "../../../utils/request";
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

const viewKey = new RequestKey({
  requestType: RequestType.npmCommand,
  npmCommand: NpmCommand.view,
});
const proxyKey = viewKey.fork({
  registryType: RegistryType.proxy,
  pkgAction: PkgAction.getInfo,
});
const localKey = viewKey.fork({
  registryType: RegistryType.local,
  pkgAction: PkgAction.getInfo,
});

const proxyHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);
  const local = localHandler.bind(null, params);

  const redirectResult = await redirectNpmRequest(event, payload.request);
  if (redirectResult instanceof Error) return local;

  const { res } = redirectResult;
  if (!res) return local;

  const { statusCode } = res;
  if (statusCode !== 200) return local;

  const data = await getIncomingMessageJson<NpmPackageInfoInstall>(res);
  if (!data) return local;

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

const localHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);

  if (!(await accessSoft(event.pkgPath.info))) return send.notFound;

  const end = await readFileSoft(event.pkgPath.info);
  return send.ok.bind(null, { end });
};

export const viewHandlers: RequestEventHandlers = {
  [proxyKey.value]: proxyHandler,
  [localKey.value]: localHandler,
};
