import * as fs from "fs/promises";
import * as path from "path";
import * as merge from "merge";

import { accessSoft, readFileSoft, readJson } from "../../utils/fs";
import {
  NpmCredentials,
  NpmPackageInfo,
  NpmPackageInfoPublish,
} from "../../utils/npm";
import { AdapterHandler } from "../adapter";
import { removeProps } from "../../utils/object";
import { generateToken } from "../../utils/crypto";
import { createPipe } from "../create-pipe";

export const install: AdapterHandler = createPipe([
  async (adapter) => {
    if (adapter.url?.startsWith("/-")) await adapter.response.sendOk();
  },
  async (adapter) => {
    if (adapter.urlPath.ext) await getTarball(adapter);
  },
  async (adapter) => {
    await getInfo(adapter);
  },
]);

const getTarball: AdapterHandler = createPipe([
  async (adapter) => {
    if (!(await accessSoft(adapter.tarballFile))) {
      await adapter.response.sendNotFound();
    }
  },
  async (adapter) => {
    await adapter.response.sendOk({
      data: await readFileSoft(adapter.tarballFile),
    });
  },
]);

const checkInfoFile: AdapterHandler = async (adapter) => {
  if (!(await accessSoft(adapter.infoFile))) {
    await adapter.response.sendNotFound();
  }
};

const getInfo: AdapterHandler = createPipe([
  checkInfoFile,
  async (adapter) => {
    await adapter.response.sendOk({
      data: await readFileSoft(adapter.infoFile),
    });
  },
]);

export const publish = createPipe([
  async (adapter) => {
    const pkgInfo = await adapter.request.json<NpmPackageInfoPublish>({
      versions: {},
      _attachments: {},
    });

    await fs.mkdir(adapter.tarballDir, { recursive: true });

    const attachments = Object.entries(pkgInfo?._attachments ?? {});

    for (const [fileName, { data }] of attachments) {
      const file = path.join(adapter.tarballDir, fileName);

      if (await accessSoft(file)) {
        await adapter.response.sendBadRequest();
        return;
      }

      await fs.writeFile(file, data, "base64");
    }
  },
  async (adapter) => {
    const pkgInfo = await adapter.request.json<NpmPackageInfoPublish>({
      versions: {},
      _attachments: {},
    });
    const tokenData = await adapter.storage.data.tokens.get(
      adapter.request.token
    );
    const userData = await adapter.storage.data.users.get(
      tokenData?.username ?? ""
    );

    if (tokenData && userData) {
      for (const [, version] of Object.entries(pkgInfo.versions)) {
        version._npmUser = {
          name: tokenData.username,
          email: userData.email,
        };
      }
    }

    const currInfo = (await readJson<NpmPackageInfo>(adapter.infoFile)) ?? {
      versions: {},
    };
    const nextInfo: NpmPackageInfo = merge.recursive(
      currInfo,
      removeProps(pkgInfo, "_attachments")
    );

    await fs.writeFile(adapter.infoFile, JSON.stringify(nextInfo, null, 2));

    await adapter.response.sendOk();
  },
]);

export const view: AdapterHandler = createPipe([
  checkInfoFile,
  async (adapter) => {
    await adapter.response.sendOk({
      data: await readFileSoft(adapter.infoFile),
    });
  },
]);

export const adduser: AdapterHandler = async (adapter) => {
  const data = await adapter.request.json<NpmCredentials>({
    name: "",
    password: "",
    email: "",
  });
  const token = generateToken();

  const tokenData = await adapter.storage.data.tokens.set(token, {
    username: data.name,
  });
  await adapter.storage.data.tokens.writeRecord(token, tokenData);
  await adapter.response.sendOk({ end: JSON.stringify({ token }) });
};

export const logout: AdapterHandler = async (adapter) => {
  await adapter.storage.data.tokens.remove(adapter.request.token);
  await adapter.storage.data.tokens.writeAll();
  await adapter.response.sendOk();
};

export const whoami: AdapterHandler = async (adapter) => {
  const tokenData = (await adapter.storage.data.tokens.get(
    adapter.request.token
  )) ?? { username: "" };

  await adapter.response.sendOk({
    end: JSON.stringify({ username: tokenData.username }),
  });
};
