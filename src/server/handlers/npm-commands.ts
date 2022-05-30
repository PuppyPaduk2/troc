import * as path from "path";
import { NpmPackageInfoInstall } from "../../utils/npm";
import { RequestData } from "../request-data";

import { AdapterHandler } from "./types";

export const adduser: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("adduser");
  await adapter.logger.addBlock("checkRegistry");
  if (!adapter.registry) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("getDataUser");
  const data = await adapter.getDataAdduser();
  if (!data) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkPassword");
  const { password, name } = data;
  const isCorrectPassword = await adapter.isCorrectPassword(password, name);
  if (!isCorrectPassword) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("send");
  const token = await adapter.createToken({ username: data.name });
  await adapter.response.sendOk({ end: JSON.stringify({ token }) });
};

export const whoami: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("whoami");
  await adapter.logger.addBlock("checkTokenData");
  const tokenData = await adapter.getTokenData();
  if (!tokenData) return await adapter.response.sendUnauthorized();

  await adapter.logger.addBlock("send");
  const end = JSON.stringify({ username: tokenData.username });
  await adapter.response.sendOk({ end });
};

export const logout: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("logout");
  await adapter.logger.addBlock("checkToken");
  if (!adapter.token) return await adapter.response.sendOk();

  await adapter.logger.addBlock("removeData");
  await adapter.registry?.cache.removeToken(adapter.token);
  await adapter.registry?.cache.removeSession(adapter.token);
  await adapter.logger.addBlock("send");
  await adapter.response.sendOk();
};

export const publish: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("publish");
  await adapter.logger.addBlock("checkRegistry");
  if (!adapter.registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkToken");
  const isCorrectToken = await adapter.isCorrectToken();
  if (!isCorrectToken) return await adapter.response.sendUnauthorized();

  if (adapter.registry.isProxy) await publishProxy(adapter);
  else await publishLocal(adapter);
};

const publishProxy: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("publishProxy");
  await adapter.logger.addBlock("proxyRequest");
  const result = await adapter.proxy();
  await adapter.logger.addBlock("checkProxyResponse");
  if (!result?.res) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkProxyAuth");
  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  await adapter.logger.addBlock("checkProxySuccess");
  if (!result.res.isSuccess) {
    return await adapter.response.send({
      statusCode: result.res.statusCode ?? 404,
    });
  }

  await adapter.logger.addBlock("send");
  const end = await result.res.data.value();
  await adapter.response.sendOk({ end });
};

const publishLocal: AdapterHandler = async (adapter) => {
  await adapter.logger.addHeader("publishLocal");
  await adapter.logger.addBlock("checkRegistry");
  const { registry } = adapter;
  if (!registry) return adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkPkgInfo");
  const pkgInfo = await adapter.getPkgInfo();
  if (!pkgInfo) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkTarballs");
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

  await adapter.logger.addBlock("changeTarballDist");
  const registryUrl = adapter.request.url.registry ?? "";
  versions.forEach(([tarballVersion, data]) => {
    const { host = "" } = adapter.request.headers;
    const tarballParams = { pkgScope, pkgName, tarballVersion };
    const tarballPathname = registry.getPkgTarballPathname(tarballParams);
    const pathname = path.join(registryUrl, tarballPathname);
    data.dist.tarball = "http://" + host + pathname;
  });
  await adapter.logger.addBlock("writing");
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
  await adapter.logger.addBlock("send");
  await adapter.response.sendOk();
};

export const view: AdapterHandler = async (adapter) => {
  await adapter.logger.addHeader("view");
  await adapter.logger.addBlock("checkRegistry");
  if (!adapter.registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkToken");
  const isCorrectToken = await adapter.isCorrectToken();
  if (!isCorrectToken) return await adapter.response.sendUnauthorized();

  if (adapter.registry.isProxy) await viewProxy(adapter);
  else await viewLocal(adapter);
};

const viewProxy: AdapterHandler = async (adapter) => {
  await adapter.logger.addHeader("viewProxy");
  await adapter.logger.addBlock("proxyRequest");
  const result = await adapter.proxy();
  await adapter.logger.addBlock("checkProxyResponse");
  if (!result?.res) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkProxyAuth");
  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  await adapter.logger.addBlock("checkProxySuccess");
  if (!result.res.isSuccess) {
    return await adapter.response.send({
      statusCode: result.res.statusCode ?? 404,
    });
  }

  await adapter.logger.addBlock("send");
  const end = await result.res.data.value();
  await adapter.response.sendOk({ end });
};

const viewLocal: AdapterHandler = async (adapter) => {
  await adapter.logger.addHeader("viewLocal");
  await adapter.logger.addBlock("checkRegistry");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkPkgParams");
  const { pkgScope, pkgName } = adapter.request.url;
  if (!pkgName) {
    return await adapter.response.sendBadRequest();
  }

  await adapter.logger.addBlock("checkAccessPkgInfo");
  const pkgInfoParams = { pkgScope, pkgName };
  if (!(await registry.accessPkgInfo(pkgInfoParams))) {
    return await adapter.response.sendNotFound();
  }

  await adapter.logger.addBlock("send");
  const end = await registry.readPkgInfo(pkgInfoParams);
  await adapter.response.sendOk({ end });
};

export const install: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("install");
  await adapter.logger.addBlock("checkRegistry");
  if (!adapter.registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkToken");
  const isCorrectToken = await adapter.isCorrectToken();
  if (!isCorrectToken) return await adapter.response.sendUnauthorized();

  if (adapter.registry.isProxy) await installProxy(adapter);
  else await installLocal(adapter);
};

const installProxy: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installProxy");
  if (adapter.request.url.tarballName) await installProxyTarball(adapter);
  else await installProxyPkgInfo(adapter);
};

const installProxyPkgInfo: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installProxyPkgInfo");
  await adapter.logger.addBlock("checkRegistry");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkPkgParams");
  const { pkgScope, pkgName } = adapter.request.url;
  if (!pkgName) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("proxyRequest");
  const result = await adapter.proxy();
  await adapter.logger.addBlock("checkProxyResponse");
  if (!result?.res) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkProxyAuth");
  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  await adapter.logger.addBlock("checkProxySuccess");
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
    return await adapter.response.sendOk({
      end: JSON.stringify(formattedPkgInfo),
    });
  }

  await adapter.logger.addBlock("checkAccessPkgInfo");
  if (!(await registry.accessPkgInfo({ pkgScope, pkgName }))) {
    return await adapter.response.sendNotFound();
  }

  await adapter.logger.addBlock("send");
  const end = await registry.readPkgInfo({ pkgScope, pkgName });
  return await adapter.response.sendOk({ end });
};

const installProxyTarball: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installProxyTarball");
  await adapter.logger.addBlock("checkRegistry");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkPkgParams");
  const { pkgScope, pkgName, tarballVersion } = adapter.request.url;
  if (!pkgName || !tarballVersion) {
    return await adapter.response.sendBadRequest();
  }

  await adapter.logger.addBlock("checkPkgTarball");
  if (await registry.accessPkgTarball({ pkgScope, pkgName, tarballVersion })) {
    const readParams = { pkgScope, pkgName, tarballVersion };
    const end = await registry.readPkgTarball(readParams);
    return await adapter.response.sendOk({ end });
  }

  await adapter.logger.addBlock("proxyRequest");
  const result = await adapter.proxy();
  await adapter.logger.addBlock("checkProxyResponse");
  if (!result?.res) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkProxyAuth");
  if (result.res.statusCode === 401) {
    return await adapter.response.sendUnauthorized();
  }

  await adapter.logger.addBlock("checkProxySuccess");
  if (!result.res.isSuccess) {
    return await adapter.response.send({
      statusCode: result.res.statusCode ?? 404,
    });
  }

  await adapter.logger.addBlock("send");
  const end = await result.res.data.value();
  const writeParams = { pkgScope, pkgName, tarballVersion, data: end };
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
  await adapter.logger.addBlock("checkRegistry");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkPkgParams");
  const { pkgScope, pkgName } = adapter.request.url;
  if (!pkgName) return await adapter.response.sendBadRequest();

  await adapter.logger.addBlock("checkAccessPkgInfo");
  const isAccessPkgInfo = await registry.accessPkgInfo({ pkgScope, pkgName });
  if (!isAccessPkgInfo) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("send");
  const readParams = { pkgScope, pkgName };
  const end = await registry.readPkgInfo(readParams);
  await adapter.response.sendOk({ end });
};

const installLocalTarball: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("installLocalTarball");
  await adapter.logger.addBlock("checkRegistry");
  const { registry } = adapter;
  if (!registry) return await adapter.response.sendNotFound();

  await adapter.logger.addBlock("checkPkgParams");
  const { pkgScope, pkgName, tarballVersion } = adapter.request.url;
  if (!pkgName || !tarballVersion) {
    return await adapter.response.sendBadRequest();
  }

  await adapter.logger.addBlock("checkAccessPkgTarball");
  if (
    !(await registry.accessPkgTarball({ pkgScope, pkgName, tarballVersion }))
  ) {
    return await adapter.response.sendNotFound();
  }

  await adapter.logger.addBlock("send");
  const readParams = { pkgScope, pkgName, tarballVersion };
  const end = await registry.readPkgTarball(readParams);
  return await adapter.response.sendOk({ end });
};
