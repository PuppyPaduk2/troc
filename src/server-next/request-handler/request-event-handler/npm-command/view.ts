import { accessSoft, readFileSoft, writeFile } from "../../../../utils/fs";
import { NpmPackageInfoInstall } from "../../../../utils/npm";
import { RegistryType } from "../../../../utils/registry";
import { getIncomingMessageJson } from "../../../../utils/request";
import { attachResponse } from "../../../../utils/response";
import { RequestKey } from "../../request-event/key";
import { NpmCommand } from "../../request-event/npm-command";
import { PkgAction } from "../../request-event/pkg-action";
import { Type } from "../../request-event/type";
import { RequestEventHandler, RequestEventHandlers } from "../types";
import { getPkgTarballUrl } from "../utils/pkg";
import { redirectNpmRequest } from "../utils/request";

const viewKey = new RequestKey({
  type: Type.npmCommand,
  npmCommand: NpmCommand.view,
});
const localKey = viewKey.fork({
  registryType: RegistryType.local,
  pkgAction: PkgAction.getInfo,
});
const proxyKey = viewKey.fork({
  registryType: RegistryType.proxy,
  pkgAction: PkgAction.getInfo,
});

const proxyHandler: RequestEventHandler = async (event, params) => {
  const send = attachResponse(params.response);
  const local = localHandler.bind(null, event, params);

  const redirectResult = await redirectNpmRequest(event, params.request);
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
      params.request.headers.host
    );
  });
  const end = JSON.stringify(data, null, 2);
  await writeFile(event.pkgPath.info, end);
  return send.ok.bind(null, { end });
};

const localHandler: RequestEventHandler = async (event, params) => {
  const send = attachResponse(params.response);

  if (!(await accessSoft(event.pkgPath.info))) return send.notFound;

  const end = await readFileSoft(event.pkgPath.info);
  return send.ok.bind(null, { end });
};

export const viewHandlers: RequestEventHandlers = {
  [localKey.value]: localHandler,
  [proxyKey.value]: proxyHandler,
};
