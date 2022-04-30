import * as fs from "fs/promises";
import * as path from "path";
import * as uuid from "uuid";

import { readFileSoft } from "../../utils/fs";

export type File = string;

export type RecordId = string;

export type CacheParams = {
  file: File;
};

export class Cache<Schema extends object> {
  private file: File;
  private dir: string;
  private data: Map<RecordId, Schema>;

  constructor(params: CacheParams) {
    this.file = params.file;
    this.dir = path.parse(this.file).dir;
    this.data = new Map();
  }

  public async read(): Promise<void> {
    const data = (await readFileSoft(this.file)).toString();
    const raw = `{"json":[${data.substring(0, data.length - 2)}]}`;

    try {
      const { json }: { json: [RecordId, Schema][] } = JSON.parse(raw);

      this.data = new Map<RecordId, Schema>(json);
    } catch {
      // pass
    }
  }

  public async write(): Promise<void> {
    const data = Array.from(this.data);
    let raw = "";

    for (let index = 0; index < data.length; index += 1) {
      raw += await Cache.toJson(data[index]);
    }

    await this.createDir();
    await fs.writeFile(this.file, raw);
  }

  public async writeRecord(id: RecordId, record: Schema): Promise<void> {
    await this.createDir();
    await fs.writeFile(this.file, await Cache.toJson([id, record]), {
      flag: "a",
    });
  }

  public async set(id: RecordId, record: Schema): Promise<Schema> {
    this.data.set(id, record);
    return record;
  }

  public async has(id: RecordId): Promise<boolean> {
    return this.data.has(id);
  }

  public async remove(id: RecordId): Promise<boolean> {
    return this.data.delete(id);
  }

  private async createDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  public async get(id: RecordId): Promise<Schema | null> {
    return this.data.get(id) ?? null;
  }

  public async count(): Promise<number> {
    return this.data.size;
  }

  static async toJson<Schema extends object>(data: Schema): Promise<string> {
    return `${JSON.stringify(data)},\n`;
  }

  static createId(): string {
    return uuid.v4();
  }
}
