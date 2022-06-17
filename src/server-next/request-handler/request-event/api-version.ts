export enum ApiVersion {
  v1 = "v1",
  unknown = "unknown",
}

const apiVersions: Record<string, ApiVersion> = {
  v1: ApiVersion.v1,
};

export const parseApiVersion = (value?: string): ApiVersion => {
  return apiVersions[value?.replace("/", "") ?? ""] ?? ApiVersion.unknown;
};
