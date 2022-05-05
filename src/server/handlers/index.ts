import { Adapter } from "../adapter";
import { v1AttachToken, v1Signup } from "./api";
import { adduser, install, logout, publish, view, whoami } from "./npm-command";

export const handleRequest = async (adapter: Adapter): Promise<void> => {
  if (!adapter.registry) await adapter.res.sendBadRequest();
  else if (adapter.req.apiVersion) await handleApi(adapter);
  else if (adapter.req.npmCommand) await handleNpmCommand(adapter);
  await adapter.res.sendNotFound();
};

const apiHandlers: Record<
  string,
  Record<string, (adapter: Adapter) => Promise<void>>
> = {
  "/v1": {
    "/signup": v1Signup,
    "/attach-token": v1AttachToken,
  },
};

const handleApi = async (adapter: Adapter): Promise<void> => {
  const versionHandler = apiHandlers[adapter.req.apiVersion] ?? {};
  const pathHandler = versionHandler[adapter.req.apiPath];
  if (pathHandler) await pathHandler(adapter);
};

const npmApiHandlers: Record<string, (adapter: Adapter) => Promise<void>> = {
  adduser,
  whoami,
  logout,
  install,
  view,
  publish,
};

const handleNpmCommand = async (adapter: Adapter): Promise<void> => {
  const handler = npmApiHandlers[adapter.req.npmCommand];
  if (handler) await handler(adapter);
};
