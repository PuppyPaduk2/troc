export enum ApiPath {
  signup = "signup",
  unknown = "unknown",
}

const apiPaths: Record<string, ApiPath> = {
  "/signup": ApiPath.signup,
};

export const parseApiPath = (apiPath?: string): ApiPath => {
  return apiPaths[apiPath ?? ""] ?? ApiPath.unknown;
};
