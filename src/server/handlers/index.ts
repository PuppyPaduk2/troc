import { match, MatchFunction } from "path-to-regexp";

import { AdapterHandler, AdapterHandlers } from "./types";
import * as apiV1 from "./api-v1";
import * as npmCommands from "./npm-commands";

export const handleRequest: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("handleRequest");
  if (!adapter.registry) await adapter.response.sendBadRequest();
  else if (adapter.request.headers.npmCommand) await handleNpmCommand(adapter);
  else if (adapter.request.url.npmApiVersion) await handleNpmApi(adapter);
  else if (adapter.request.url.trocApiVersion) await handleTrocApi(adapter);
};

const toAdapterHandlers = (
  handlers: Record<string, AdapterHandler>
): AdapterHandlers => {
  return Object.entries(handlers).map<[MatchFunction, AdapterHandler]>(
    ([key, handler]) => [match(key), handler]
  );
};

const npmCommandHandlers = toAdapterHandlers({
  adduser: npmCommands.adduser,
  whoami: npmCommands.whoami,
  logout: npmCommands.logout,
  publish: npmCommands.publish,
  view: npmCommands.view,
  install: npmCommands.install,
});

const handleNpmCommand: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("handleNpmCommand");
  const npmCommand = adapter.request.headers.npmCommand ?? "";
  const [, handler] =
    npmCommandHandlers.find(([match]) => match(npmCommand)) ?? [];
  if (handler) await handler(adapter);
};

const npmApiHandlers = toAdapterHandlers({
  "/v1/security/audits/quick": (adapter) => adapter.response.sendOk(),
});

const handleNpmApi: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("handleNpmApi");
  const { url } = adapter.request;
  const key = (url.npmApiVersion ?? "") + (url.npmApiPath ?? "");
  const [, handler] = npmApiHandlers.find(([match]) => match(key)) ?? [];
  if (handler) await handler(adapter);
};

const trocApiHandlers = toAdapterHandlers({
  "/v1/signup": apiV1.signup,
  "/v1/attach-token": apiV1.attachToken,
});

const handleTrocApi: AdapterHandler = async (adapter) => {
  await adapter.logger.addTitle("handleTrocApi");
  const { url } = adapter.request;
  const key = (url.trocApiVersion ?? "") + (url.trocApiPath ?? "");
  const [, handler] = trocApiHandlers.find(([match]) => match(key)) ?? [];
  if (handler) await handler(adapter);
};
