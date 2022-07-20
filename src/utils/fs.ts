import * as fsp from "fs/promises";
import * as path from "path";

export async function accessSoft(file: string): Promise<boolean> {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readFileSoft(file: string): Promise<Buffer> {
  try {
    return await fsp.readFile(file);
  } catch {
    return Buffer.from([]);
  }
}

export async function readJson<R extends object>(
  file: string
): Promise<R | null> {
  try {
    return JSON.parse((await fsp.readFile(file)).toString());
  } catch {
    return null;
  }
}

export const writeFile = async (
  file: string,
  data: Buffer | string,
  options?: WriteFileOptions
) => {
  await mkdir(path.dirname(file));
  return fsp.writeFile(file, data, options);
};

type WriteFileOptions = Parameters<typeof fsp.writeFile>[2];

export async function writeJson(
  file: string,
  data: object,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacer?: ((this: any, key: string, value: any) => any) | null,
  space?: string | number
): Promise<void> {
  return fsp.writeFile(
    file,
    JSON.stringify(data, replacer ?? undefined, space)
  );
}

export async function writeBase64(
  file: string,
  data: Buffer | string
): Promise<void> {
  await mkdir(path.dirname(file));
  return await fsp.writeFile(file, data, "base64");
}

export async function mkdir(file: string): Promise<string | void> {
  return fsp.mkdir(file, { recursive: true });
}

export async function removeFile(file: string): Promise<boolean> {
  try {
    await fsp.unlink(file);
    return true;
  } catch {
    return false;
  }
}
