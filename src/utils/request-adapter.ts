import * as path from "path";
import * as fs from "fs/promises";

import { accessSoft, readFileSoft } from "./fs";
import { RequestMeta } from "./request-meta";
import { ResponseMeta } from "./response-meta";
import { ServerConfig } from "./server-config";
import { NpmPackageInfo } from "./npm";

export type RequestAdapterPaths = {
  tarball: {
    dir: string;
    file: string;
  };
  info: {
    dir: string;
    file: string;
  };
};

export class RequestAdapter<DataAdapter = unknown> {
  public req: RequestMeta;
  public res: ResponseMeta;
  public config: ServerConfig = new ServerConfig();
  public data: DataAdapter;

  constructor(params: {
    req: RequestMeta;
    res: ResponseMeta;
    config?: ServerConfig;
    data: DataAdapter;
  }) {
    this.req = params.req;
    this.res = params.res;
    this.config = params.config ?? this.config;
    this.data = params.data;
  }

  // Tarball
  public async createTarballDir(): Promise<string | undefined> {
    return await fs.mkdir(this.paths.tarball.dir, { recursive: true });
  }

  public async accessTarballFile(): Promise<boolean> {
    return await accessSoft(this.paths.tarball.file);
  }

  public async readTarballFile(): Promise<Buffer> {
    return await readFileSoft(this.paths.tarball.file);
  }

  public async writeTarballFile(
    file: string,
    data: Buffer | string
  ): Promise<void> {
    return await fs.writeFile(file, data, "base64");
  }

  // Info
  public async createInfoDir(): Promise<string | undefined> {
    return await fs.mkdir(this.paths.info.dir, { recursive: true });
  }

  public async accessInfoFile(): Promise<boolean> {
    return await accessSoft(this.paths.info.file);
  }

  public async readInfoFile(): Promise<Buffer> {
    return await readFileSoft(this.paths.info.file);
  }

  public async readInfoFileJson(): Promise<NpmPackageInfo> {
    try {
      return JSON.parse((await this.readInfoFile()).toString());
    } catch {
      return { versions: {} };
    }
  }

  public async writeInfoFile(
    file: string,
    data: Buffer | string
  ): Promise<void> {
    return await fs.writeFile(file, data);
  }

  public get paths(): RequestAdapterPaths {
    const tarballDir = path.join(
      this.config.registryDir,
      this.req.parsedUrl.dir,
      this.req.command === "publish" ? this.req.parsedUrl.base : "",
      this.req.command === "publish" ? "-" : ""
    );
    const infoDir = path.join(
      this.config.registryDir,
      this.req.parsedUrl.dir,
      this.req.parsedUrl.base
    );

    return {
      tarball: {
        dir: tarballDir,
        file: path.join(tarballDir, this.req.parsedUrl.base),
      },
      info: {
        dir: infoDir,
        file: path.join(infoDir, "info.json"),
      },
    };
  }
}
