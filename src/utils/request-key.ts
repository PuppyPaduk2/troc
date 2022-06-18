import { NpmCommand } from "./npm-command";
import { buildPkgAction, PkgAction } from "./pkg-action";
import { Registry, RegistryType } from "./registry";
import { buildRequestType, RequestType } from "./request-type";
import { ParsedUrl } from "./url";

export { NpmCommand, PkgAction, RegistryType, RequestType };

export class RequestKey {
  params: RequestKeyParams = {
    registryType: RegistryType.unknown,
    requestType: RequestType.unknown,
    npmCommand: null,
    pkgAction: PkgAction.unknown,
    apiVersion: "",
    apiPath: "",
  };

  constructor(params: Partial<RequestKeyParams>) {
    this.params = Object.freeze({ ...this.params, ...params });
  }

  get value(): string {
    const chunks: ChunkValue[] = [];
    switch (this.params.requestType) {
      case RequestType.npmCommand:
        chunks.push(
          this.params.requestType,
          this.params.npmCommand,
          this.params.registryType,
          this.params.pkgAction
        );
        break;
      case RequestType.npmApi:
        chunks.push(
          this.params.requestType,
          this.params.apiVersion,
          this.params.apiPath
        );
        break;
      default:
        chunks.push(this.params.requestType);
        break;
    }
    return chunks
      .filter(Boolean)
      .filter((chunk) => chunk !== "unknown")
      .join(RequestKey.chunkSeparator);
  }

  fork(params: Partial<RequestKeyParams>): RequestKey {
    return new RequestKey({ ...this.params, ...params });
  }

  static chunkSeparator = "/";

  static buildParams = (params: {
    parsedUrl: ParsedUrl;
    registry: Registry;
    npmCommand: NpmCommand | null;
  }): RequestKeyParams => {
    const { parsedUrl, registry, npmCommand } = params;
    return {
      registryType: registry.type,
      requestType: buildRequestType({ parsedUrl, npmCommand }),
      pkgAction: buildPkgAction({ parsedUrl, npmCommand }),
      apiVersion: parsedUrl.apiVersion,
      apiPath: parsedUrl.apiPath,
      npmCommand,
    };
  };
}

type RequestKeyParams = {
  registryType: RegistryType;
  requestType: RequestType;
  npmCommand: NpmCommand | null;
  pkgAction: PkgAction;
  apiVersion: string;
  apiPath: string;
};

type ChunkValue = string | null | void;
