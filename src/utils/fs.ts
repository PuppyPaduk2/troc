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
