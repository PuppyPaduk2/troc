import * as path from "path";

export type ServerConfigParams = {
  storageDir: string;
};

export class ServerConfig {
  private params: ServerConfigParams = {
    storageDir: path.join(__dirname, "storage"),
  };

  constructor(params?: Partial<ServerConfigParams>) {
    this.params = { ...this.params, ...params };
  }

  public get storageDir() {
    return this.params.storageDir;
  }

  public get registryDir() {
    return path.join(this.storageDir, "registry");
  }
}
