import * as http from "http";
import * as path from "path";

import { removeProps, removePropsEmpty } from "../../../../utils/object";
import {
  getIncomingMessageData,
  RedirectedRequest,
  redirectRequest,
  requestToOptions,
  urlToOptions,
} from "../../../../utils/request";
import { RequestEvent } from "../../request-event";

export const redirectNpmRequest = async (
  event: RequestEvent,
  request: http.IncomingMessage
): Promise<RedirectedRequest | Error> => {
  const requestOptions = getOptions(event, request);
  if (requestOptions instanceof Error) return requestOptions;

  const data = await getIncomingMessageData(request);
  return await redirectRequest(requestOptions, { data });
};

const headersForRemoving = ["host", "accept", "accept-encoding"];

const getOptions = (
  event: RequestEvent,
  request: http.IncomingMessage
): http.RequestOptions | Error => {
  const targetUrl = event.registry.getProxyUrl({
    npmCommand: event.npmCommand,
    pkgScope: event.parsedUrl.pkgScope,
    pkgName: event.parsedUrl.pkgName,
  });
  if (!targetUrl) return new Error("Target url  doesn't exist");

  // TODO Get url by parsedUrl
  const targetURL = new URL(targetUrl);
  const requestUrl = decodeURIComponent(request.url ?? "");
  targetURL.pathname = path.join(
    targetURL.pathname,
    requestUrl.replace(event.registry.path, "")
  );
  const options = { ...urlToOptions(targetURL), ...requestToOptions(request) };
  options.headers = removeProps(options.headers ?? {}, ...headersForRemoving);
  return removePropsEmpty(options);
};
