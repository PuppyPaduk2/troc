import { NpmCommand, parseNpmCommand } from "./npm-command";
import { buildPkgAction, PkgAction } from "./pkg-action";
import { getRegistryType, Registry, RegistryType } from "./registry";
import { buildRequestType, RequestType } from "./request-type";
import { ParsedUrl } from "./url";

export { NpmCommand, PkgAction, RegistryType, RequestType };

export class RequestKey {
  private _params: RequestKeyParams = {
    registryType: RegistryType.unknown,
    requestType: RequestType.unknown,
    npmCommand: null,
    pkgAction: PkgAction.unknown,
    apiVersion: "",
    apiPath: "",
  };

  constructor(params: Partial<RequestKeyParams>) {
    this._params = { ...this._params, ...params };
  }

  get value(): string {
    const chunks: ChunkValue[] = [];
    switch (this._params.requestType) {
      case RequestType.npmCommand:
        chunks.push(
          this._params.requestType,
          this._params.npmCommand,
          this._params.registryType,
          this._params.pkgAction
        );
        break;
      case RequestType.npmApi:
        chunks.push(
          this._params.requestType,
          this._params.apiVersion,
          this._params.apiPath
        );
        break;
      default:
        chunks.push(this._params.requestType);
        break;
    }
    return chunks
      .filter(Boolean)
      .filter((chunk) => chunk !== "unknown")
      .join(RequestKey.chunkSeparator);
  }

  fork(params: Partial<RequestKeyParams>): RequestKey {
    return new RequestKey({ ...this._params, ...params });
  }

  static chunkSeparator = "/";

  static buildParams = (params: {
    parsedUrl: ParsedUrl;
    registry: Registry;
    referer?: string;
  }): RequestKeyParams => {
    const { parsedUrl, registry, referer } = params;
    const npmCommand = parseNpmCommand(referer);
    return {
      registryType: getRegistryType(registry),
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
