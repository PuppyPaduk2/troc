import * as path from "path";
import { NpmPackageInfoInstall } from "../../utils/npm";
import { RequestData } from "../request-data";

import { AdapterHandler } from "./types";

export const adduser: AdapterHandler = async (adapter) => {
  if (!adapter.registry) return await adapter.response.sendBadRequest();

  const data = await adapter.getDataAdduser();
  if (!data) return await adapter.response.sendBadRequest();

  const { password, name } = data;
  const isCorrectPassword = await adapter.isCorrectPassword(password, name);
  if (!isCorrectPassword) return await adapter.response.sendBadRequest();

  const token = await adapter.createToken({ username: data.name });
  await adapter.response.sendOk({ end: JSON.stringify({ token }) });
};

export const whoami: AdapterHandler = async (adapter) => {
  const tokenData = await adapter.getTokenData();
  if (!tokenData) return await adapter.response.sendUnauthorized();

  const end = JSON.stringify({ username: tokenData.username });
  await adapter.response.sendOk({ end });
};

export const logout: AdapterHandler = async (adapter) => {
  if (!adapter.token) return await adapter.response.sendOk();

  await adapter.registry?.cache.removeToken(adapter.token);
  await adapter.registry?.cache.removeSession(adapter.token);
  await adapter.response.sendOk();
};

export const publish: AdapterHandler = async (adapter) => {
  if (!adapter.registry) return await adapter.response.sendNotFound();

  const isCorrectToken = await adapter.isCorrectToken();
  if (!isCorrectToken) return await adapter.response.sendUnauthorized();

  if (adapter.registry.isProxy) await publishProxy(adapter);
  else await publishLocal(adapter);
};

const publishProxy: AdapterHandler = async (adapter) => {
  const result = await adapter.proxy();
  if (!result?.res) return await adapter.response.sendBadRequest();

  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  if (!result.res.isSuccess) {
    return await adapter.response.send({
      statusCode: result.res.statusCode ?? 404,
    });
  }

  const end = await result.res.data.value();
  await adapter.response.sendOk({ end });
};

const publishLocal: AdapterHandler = async (adapter) => {
  const { registry } = adapter;
  if (!registry) return adapter.response.sendBadRequest();

  const pkgInfo = await adapter.getPkgInfo();
  if (!pkgInfo) return await adapter.response.sendBadRequest();

  const expPkgScope = /^(@[\w\d_\-.]+)\/([\w\d_\-.]+)$/;
  const matchResultPkgScope = pkgInfo.name.match(expPkgScope);
  const pkgScope = matchResultPkgScope ? matchResultPkgScope[1] ?? null : null;
  const pkgName = matchResultPkgScope ? matchResultPkgScope[2] : pkgInfo.name;
  const versions = Object.entries(pkgInfo.versions);
  const versionKeys = versions.map(([version]) => version);
  const accessing = versionKeys.map((tarballVersion) => {
    return registry.accessPkgTarball({ pkgScope, pkgName, tarballVersion });
  });
  const accessingResult = await Promise.all(accessing);
  const isFalse = (value: boolean) => value === false;
  const isIncorrect = !accessingResult.filter(isFalse).length;
  if (isIncorrect) return await adapter.response.sendBadRequest();

  const registryUrl = adapter.request.url.registry ?? "";
  versions.forEach(([tarballVersion, data]) => {
    const { host = "" } = adapter.request.headers;
    const tarballParams = { pkgScope, pkgName, tarballVersion };
    const tarballPathname = registry.getPkgTarballPathname(tarballParams);
    const pathname = path.join(registryUrl, tarballPathname);
    data.dist.tarball = "http://" + host + pathname;
  });
  const attachmentKeys = versionKeys.map((version) => {
    return path.join(pkgScope ?? "", pkgName) + "-" + version + ".tgz";
  });
  const writing = attachmentKeys.map((attachmentKey, index) => {
    const tarballVersion = versionKeys[index];
    const { data } = pkgInfo._attachments[attachmentKey];
    const params = { pkgScope, pkgName, tarballVersion, data };
    return registry.writePkgTarball(params);
  });
  await Promise.all(writing);
  const mergeParams = { pkgScope, pkgName, pkgInfo };
  const nextPkgInfo = await registry.mergePkgInfo(mergeParams);
  await registry.writePkgInfo({ pkgScope, pkgName, pkgInfo: nextPkgInfo });
  await adapter.response.sendOk();
};

export const view: AdapterHandler = async (adapter) => {
  if (!adapter.registry) return await adapter.response.sendNotFound();

  const isCorrectToken = await adapter.isCorrectToken();
  if (!isCorrectToken) return await adapter.response.sendUnauthorized();

  if (adapter.registry.isProxy) await viewProxy(adapter);
  else await viewLocal(adapter);
};

const viewProxy: AdapterHandler = async (adapter) => {
  const result = await adapter.proxy();
  if (!result?.res) return await adapter.response.sendNotFound();

  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  if (!result.res.isSuccess) {
    return await adapter.response.send({
      statusCode: result.res.statusCode ?? 404,
    });
  }

  const end = await result.res.data.value();
  await adapter.response.sendOk({ end });
};

const viewLocal: AdapterHandler = async (adapter) => {
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendBadRequest();

  const { pkgScope, pkgName } = adapter.request.url;
  if (!pkgName) {
    return await adapter.response.sendBadRequest();
  }

  const pkgInfoParams = { pkgScope, pkgName };
  if (!(await registry.accessPkgInfo(pkgInfoParams))) {
    return await adapter.response.sendNotFound();
  }

  const end = await registry.readPkgInfo(pkgInfoParams);
  await adapter.response.sendOk({ end });
};

export const install: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("install");
  const isRegistry = !!adapter.registry;
  await adapter.logger.addValue("isRegistry", isRegistry.toString());
  if (!isRegistry) return await adapter.response.sendNotFound();

  const isCorrectToken = await adapter.isCorrectToken();
  await adapter.logger.addValue("token", adapter.token?.toString() ?? "");
  await adapter.logger.addValue("isCorrectToken", isCorrectToken.toString());
  if (!isCorrectToken) return await adapter.response.sendUnauthorized();

  const { isProxy } = adapter.registry;
  await adapter.logger.addValue("isProxy", isProxy.toString());
  if (adapter.registry.isProxy) await installProxy(adapter);
  else await installLocal(adapter);
};

const installProxy: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installProxy");
  const { tarballName } = adapter.request.url;
  await adapter.logger.addValue("tarballName", tarballName ?? "");
  if (tarballName) await installProxyTarball(adapter);
  else await installProxyPkgInfo(adapter);
};

const installProxyPkgInfo: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installProxyPkgInfo");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  const { pkgScope, pkgName } = adapter.request.url;
  await adapter.logger.addValue("pkgName", pkgName ?? "");
  if (!pkgName) return await adapter.response.sendBadRequest();

  const result = await adapter.proxy();
  if (!result?.res) return await adapter.response.sendBadRequest();

  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  if (result.res.isSuccess) {
    const data = await result.res.data.value();
    const pkgInfo = await RequestData.toJson<NpmPackageInfoInstall | null>(
      data,
      null
    );
    if (!pkgInfo) return await adapter.response.sendBadRequest();

    const formattedPkgInfo = await adapter.hooks.formatPackageInfo(pkgInfo);
    const writeParams = { pkgInfo: formattedPkgInfo, pkgScope, pkgName };
    await registry.writePkgInfo(writeParams);
    await adapter.response.sendOk({ end: JSON.stringify(formattedPkgInfo) });
  }

  if (!(await registry.accessPkgInfo({ pkgScope, pkgName }))) {
    return await adapter.response.sendNotFound();
  }

  const end = await registry.readPkgInfo({ pkgScope, pkgName });
  return await adapter.response.sendOk({ end });
};

const installProxyTarball: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installProxyTarball");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  const { pkgScope, pkgName, tarballVersion } = adapter.request.url;
  await adapter.logger.addValue("pkgScope", pkgScope ?? "");
  await adapter.logger.addValue("pkgName", pkgName ?? "");
  await adapter.logger.addValue("tarballVersion", tarballVersion ?? "");
  if (!pkgName || !tarballVersion) {
    return await adapter.response.sendBadRequest();
  }

  if (await registry.accessPkgTarball({ pkgScope, pkgName, tarballVersion })) {
    const readParams = { pkgScope, pkgName, tarballVersion };
    const end = await registry.readPkgTarball(readParams);
    return await adapter.response.sendOk({ end });
  }

  const result = await adapter.proxy();
  if (!result?.res) return await adapter.response.sendBadRequest();

  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  if (!result.res.isSuccess) {
    return await adapter.response.send({
      statusCode: result.res.statusCode ?? 404,
    });
  }

  const end = await result.res.data.value();
  const writeParams = { pkgScope, pkgName, tarballVersion, data: end };
  await adapter.logger.addValue(
    "pkgTarballFile",
    adapter.registry?.getPkgTarballFile(writeParams) ?? ""
  );
  await registry.writePkgTarball(writeParams);
  await adapter.response.sendOk({ end });
};

const installLocal: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installLocal");
  const { tarballName } = adapter.request.url;
  if (tarballName) await installLocalTarball(adapter);
  else await installLocalPkgInfo(adapter);
};

const installLocalPkgInfo: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installLocalPkgInfo");
  await adapter.logger.addBlock("check registry");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("check pkg params");
  const { pkgScope, pkgName } = adapter.request.url;
  await adapter.logger.addValue("pkgScope", pkgScope ?? "");
  await adapter.logger.addValue("pkgName", pkgName ?? "");
  if (!pkgName) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("check pkg info file");
  const isAccessPkgInfo = await registry.accessPkgInfo({ pkgScope, pkgName });
  await adapter.logger.addValue("isAccessPkgInfo", isAccessPkgInfo.toString());
  if (!isAccessPkgInfo) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("read pkg info");
  const readParams = { pkgScope, pkgName };
  await adapter.logger.addValue(
    "pkgInfoFile",
    registry.getPkgInfoFile(readParams)
  );
  const end = await registry.readPkgInfo(readParams);
  await adapter.response.sendOk({ end });
};

const installLocalTarball: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installLocalTarball");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  const { pkgScope, pkgName, tarballVersion } = adapter.request.url;
  await adapter.logger.addValue("pkgScope", pkgScope ?? "");
  await adapter.logger.addValue("pkgName", pkgName ?? "");
  await adapter.logger.addValue("tarballVersion", tarballVersion ?? "");
  if (!pkgName || !tarballVersion) {
    return await adapter.response.sendBadRequest();
  }

  if (
    !(await registry.accessPkgTarball({ pkgScope, pkgName, tarballVersion }))
  ) {
    return await adapter.response.sendNotFound();
  }

  const readParams = { pkgScope, pkgName, tarballVersion };
  const end = await registry.readPkgTarball(readParams);
  return await adapter.response.sendOk({ end });
};
