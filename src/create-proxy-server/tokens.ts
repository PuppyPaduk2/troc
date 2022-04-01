import * as path from "path";
import * as fs from "fs/promises";

import { readJson } from "../utils/fs";
import { Config } from "./config";
import { generateToken } from "../utils/crypto";

type RegistryTokenData = { token: string };

type JsonDataTokens = [string, [string, RegistryTokenData][]][];

type DataTokens = Map<string, Map<string, RegistryTokenData>>;

export class Tokens {
  private config: Config = new Config();
  private data: DataTokens = new Map();

  constructor(params: { config?: Config } = {}) {
    this.config = params.config ?? this.config;
  }

  public get file(): string {
    return path.join(this.config.storageDir, this.config.serverEnvs.tokensName);
  }

  public async read(): Promise<void> {
    this.data = Tokens.toData(await Tokens.readData(this.file));
  }

  public async write() {
    await fs.writeFile(this.file, JSON.stringify(Tokens.toRawData(this.data)));
  }

  public set(targetUrl: string, targetToken: string, token?: string): string {
    const currToken = token || generateToken();
    const tokenData = this.data.get(currToken);
    const rTokenData: RegistryTokenData = { token: targetToken };

    if (tokenData) {
      tokenData.set(targetUrl, rTokenData);
    } else {
      this.data.set(currToken, new Map([[targetUrl, rTokenData]]));
    }

    return currToken;
  }

  public get(token: string, targetUrl: string): string {
    const tokenData = this.data.get(token);

    if (!tokenData) {
      return "";
    }

    return tokenData.get(targetUrl)?.token ?? "";
  }

  public has(token: string, targetUrl?: string): boolean {
    const tokenData = this.data.get(token);

    if (targetUrl) {
      return !!tokenData?.get(targetUrl);
    }

    return !!tokenData;
  }

  public remove(token: string, targetUrl?: string): boolean {
    if (targetUrl) {
      return this.data.get(token)?.delete(targetUrl) ?? false;
    }

    return this.data.delete(token);
  }

  public count(token: string): number {
    return this.data.get(token)?.size ?? 0;
  }

  static async readData(file: string): Promise<JsonDataTokens> {
    return (await readJson<JsonDataTokens>(file)) ?? [];
  }

  static toData(jsonData: JsonDataTokens): DataTokens {
    return new Map(
      jsonData.map(([token, subTokens]) => [token, new Map(subTokens)])
    );
  }

  static toRawData(data: DataTokens): JsonDataTokens {
    return Array.from(data).map(([key, tokens]) => [key, Array.from(tokens)]);
  }
}
