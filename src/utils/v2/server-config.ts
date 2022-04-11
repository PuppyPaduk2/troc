import * as path from "path";

export class ServerConfig {
  public storageDir: string = path.join(__dirname, "storage");

  constructor(params?: { storageDir?: string }) {
    this.storageDir = params?.storageDir ?? this.storageDir;
  }

  private getStorageFile(file: string): string {
    return path.join(this.storageDir, file);
  }

  public get registryDir(): string {
    return this.getStorageFile("registry");
  }
}
