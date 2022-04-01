import * as fs from "fs/promises";

export async function accessSoft(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<R extends object>(
  file: string
): Promise<R | null> {
  try {
    return JSON.parse((await fs.readFile(file)).toString());
  } catch {
    return null;
  }
}

export async function writeJson(
  file: string,
  data: object,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacer?: ((this: any, key: string, value: any) => any) | null,
  space?: string | number
): Promise<void> {
  return fs.writeFile(file, JSON.stringify(data, replacer ?? undefined, space));
}
