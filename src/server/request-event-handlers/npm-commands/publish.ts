import * as merge from "merge";

import {
  accessSoft,
  readJson,
  writeBase64,
  writeFile,
} from "../../../utils/fs";
import { NpmPackageInfo, NpmPackageInfoPublish } from "../../../utils/npm";
import { removeProps } from "../../../utils/object";
import {
  getIncomingMessageData,
  getIncomingMessageJson,
} from "../../../utils/request";
import {
  NpmCommand,
  RegistryType,
  RequestKey,
  RequestType,
} from "../../../utils/request-key";
import { attachResponse } from "../../../utils/response";
import { RequestEventHandler, RequestEventHandlers } from "../types";
import { redirectNpmRequest } from "./utils/request";

const publishKey = new RequestKey({
  requestType: RequestType.npmCommand,
  npmCommand: NpmCommand.publish,
});
const proxyKey = publishKey.fork({
  registryType: RegistryType.proxy,
});
const localKey = publishKey.fork({
  registryType: RegistryType.local,
});

const proxyHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);

  const redirectResult = await redirectNpmRequest(event, payload.request);
  if (redirectResult instanceof Error) return send.badRequest;

  const { res } = redirectResult;
  if (!res) return send.badRequest;

  const { statusCode } = res;
  if (statusCode !== 200) return () => send.badRequest({ statusCode });

  const end = await getIncomingMessageData(res);
  return () => send.ok({ end });
};

const localHandler: RequestEventHandler = async (params) => {
  const { event, payload } = params;
  const send = attachResponse(payload.response);

  const pkgInfo = await getIncomingMessageJson<NpmPackageInfoPublish>(
    payload.request
  );
  if (!pkgInfo) return send.badRequest;

  const checkingExistPkgTarball = await Promise.all(
    Object.keys(pkgInfo.versions)
      .map((tarballVersion) => event.pkgPath.fork({ tarballVersion }).tarball)
      .map(accessSoft)
  );
  const isAccessWrite = !!checkingExistPkgTarball.filter((value) => !value)
    .length;

  if (!isAccessWrite) return send.badRequest;

  // Writing package info (pkgInfo)
  const currPkgInfo = await readJson<NpmPackageInfo>(event.pkgPath.info);
  const nextPkgInfo = merge.recursive(
    currPkgInfo ?? {},
    removeProps(pkgInfo, "_attachments")
  );
  await writeFile(event.pkgPath.info, JSON.stringify(nextPkgInfo, null, 2));

  // Writing tarballs
  await Promise.all(
    Object.keys(pkgInfo.versions).map((tarballVersion) => {
      const pkgPath = event.pkgPath.fork({ tarballVersion });
      const { data } = pkgInfo._attachments[pkgPath.tarballKey];
      return writeBase64(pkgPath.tarball, data);
    })
  );

  return send.ok;
};

export const publishHandlers: RequestEventHandlers = {
  [proxyKey.value]: proxyHandler,
  [localKey.value]: localHandler,
};
