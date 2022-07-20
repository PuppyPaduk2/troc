import objectHash from "object-hash";

import { readFileSoft } from "./fs";
import { glob } from "./glob";

type DirHash = {
  value: string;
  files: Record<string, string>;
  calcFileHash: (filePath: string) => Promise<boolean>;
};

export const getDirHash = async (dir: string): Promise<DirHash> => {
  const dirHash: DirHash = {
    value: "",
    files: {},
    calcFileHash: async (filePath) => {
      const buf = await readFileSoft(filePath);
      const hash = objectHash(buf);

      if (dirHash.files[filePath] === hash) return false;

      dirHash.files[filePath] = hash;
      dirHash.value = objectHash(dirHash.files);
      return true;
    },
  };

  const matches = await glob("**/**", {
    ignore: ["**/node_modules/**", "**/.git/**"],
    cwd: dir,
    dot: true,
    absolute: true,
  });
  dirHash.files = Object.fromEntries(
    await Promise.all(
      matches.map((path) =>
        readFileSoft(path).then((buf) => [path, objectHash(buf)])
      )
    )
  );
  dirHash.value = objectHash(dirHash.files);
  return dirHash;
};
