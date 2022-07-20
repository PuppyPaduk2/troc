import objectHash from "object-hash";
import { join } from "path";

import { readFileSoft, removeFile, writeFile } from "../../utils/fs";
import { Config } from "./types";

export const detach = async (config: Config): Promise<void> => {
  await Promise.all(
    Object.values(config.packages).map(async (packageMeta) => {
      if (packageMeta.npmrc in config.npmrcs) {
        const path = getPath(packageMeta.dir);
        const data = config.npmrcs[packageMeta.npmrc];
        if (data.length) {
          await writeFile(path, data, "base64");
        } else {
          await removeFile(path);
        }
      }
    })
  );
};

export const attach = async (config: Config): Promise<void> => {
  await Promise.all(
    Object.values(config.packages).map(async (packageMeta) => {
      const registry = config.registries[packageMeta.registry];
      if (registry) {
        await writeFile(
          getPath(packageMeta.dir),
          `registry=http://localhost:${config.port}${registry.path}\n`
        );
      }
    })
  );
};

export const remove = async (config: Config): Promise<void> => {
  const npmrcHashes = Object.values(config.packages).map(({ npmrc }) => npmrc);

  config.npmrcs = Object.fromEntries(
    Object.entries(config.npmrcs).filter(([hash]) => npmrcHashes.includes(hash))
  );
};

export const set = async (config: Config): Promise<void> => {
  await Promise.all(
    Object.values(config.packages).map(async (meta) => {
      if (!meta.npmrc || !(meta.npmrc in config.npmrcs)) {
        const path = getPath(meta.dir);
        const data = await readFileSoft(path);
        const base64 = data.toString("base64");
        const hash = objectHash(base64);
        meta.npmrc = hash;
        config.npmrcs[hash] = base64;
      }
    })
  );
};

const getPath = (dir: string): string => join(dir, ".npmrc");
