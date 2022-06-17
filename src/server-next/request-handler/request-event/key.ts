import { RegistryType } from "../../../utils/registry";
import { ApiPath } from "./api-path";
import { ApiVersion } from "./api-version";

import { NpmCommand } from "./npm-command";
import { PkgAction } from "./pkg-action";
import { Type } from "./type";

type ChunkValue = string | null | void;

type RequestKeyParams = {
  registryType?: RegistryType;
  type?: Type;
  npmCommand?: NpmCommand | null;
  pkgAction?: PkgAction;
  apiVersion?: ApiVersion;
  apiPath?: ApiPath;
};

const chunkSeparator = "/";

export class RequestKey {
  registryType: RegistryType = RegistryType.local;
  type: Type = Type.unknown;
  npmCommand: NpmCommand | null = null;
  pkgAction: PkgAction = PkgAction.unknown;
  apiVersion: ApiVersion = ApiVersion.unknown;
  apiPath: ApiPath = ApiPath.unknown;

  constructor(params: RequestKeyParams) {
    this.registryType = params.registryType ?? this.registryType;
    this.type = params.type ?? this.type;
    this.npmCommand = params.npmCommand ?? this.npmCommand;
    this.pkgAction = params.pkgAction ?? this.pkgAction;
    this.apiVersion = params.apiVersion ?? this.apiVersion;
    this.apiPath = params.apiPath ?? this.apiPath;
  }

  get value(): string {
    const chunks: ChunkValue[] = [];
    switch (this.type) {
      case Type.npmCommand:
        chunks.push(
          this.type,
          this.npmCommand,
          this.registryType,
          this.pkgAction
        );
        break;
      case Type.npmApi:
        chunks.push(this.type, this.apiVersion, this.apiPath);
        break;
      default:
        chunks.push(this.type);
        break;
    }
    return chunks
      .filter(Boolean)
      .filter((chunk) => chunk !== "unknown")
      .join(chunkSeparator);
  }

  fork(params: RequestKeyParams): RequestKey {
    return new RequestKey({ ...this, ...params });
  }
}
