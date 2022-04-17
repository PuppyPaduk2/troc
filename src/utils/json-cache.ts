import * as fs from "fs/promises";
import * as uuid from "uuid";
import * as path from "path";

import { readFileSoft } from "./fs";

export type RecordId = string;

export type SchemaJson = string;

export type JsonCacheSetOptions = {
  write: boolean;
};

export class JsonCache<Schema extends object> {
  private records: Map<RecordId, Schema>;
  public file: string;

  constructor(file: string) {
    this.file = file;
    this.records = new Map();
  }

  public async readAll(): Promise<void> {
    const data = (await readFileSoft(this.file)).toString();
    const raw = `{"json":[${data.substring(0, data.length - 2)}]}`;

    try {
      const { json }: { json: [RecordId, Schema][] } = JSON.parse(raw);

      this.records = new Map<RecordId, Schema>(json);
    } catch {
      // pass
    }
  }

  public async writeAll(): Promise<void> {
    const data = Array.from(this.records);
    let raw = "";

    for (let index = 0; index < data.length; index += 1) {
      raw += await JsonCache.toJson(data[index]);
    }

    await fs.mkdir(path.parse(this.file).dir, { recursive: true });
    await fs.writeFile(this.file, raw);
  }

  public async writeRecord(id: RecordId, data: Schema): Promise<void> {
    await fs.mkdir(path.parse(this.file).dir, { recursive: true });
    await fs.writeFile(this.file, await JsonCache.toJson([id, data]), {
      flag: "a",
    });
  }

  public async set(
    id: RecordId,
    data: Schema,
    options: JsonCacheSetOptions = { write: true }
  ): Promise<void> {
    this.records.set(id, data);

    if (options.write) await this.writeRecord(id, data);
  }

  public async change(
    id: RecordId,
    data: Partial<Schema>,
    options: JsonCacheSetOptions = { write: true }
  ): Promise<boolean> {
    const record = this.records.get(id);

    if (!record) return false;

    this.set(id, { ...record, data }, options);
    return true;
  }

  public async remove(
    id: RecordId,
    options: { write: boolean } = { write: true }
  ): Promise<boolean> {
    const result = this.records.delete(id);

    if (options.write) await this.writeAll();

    return result;
  }

  public async get(id: RecordId): Promise<Schema | null> {
    return this.records.get(id) ?? null;
  }

  public async count(): Promise<number> {
    return this.records.size;
  }

  public createId(): string {
    return uuid.v4();
  }

  static async toJson<Schema extends object>(data: Schema): Promise<string> {
    return `${JSON.stringify(data)},\n`;
  }
}
