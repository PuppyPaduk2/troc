import * as http from "http";

import { handleRequest } from "./handlers";
import { Response } from "./response";
import { RequestNext } from "./request";
import { AdapterNext } from "./adapter";
import { RegistryNext, RegistryUrl } from "./registry";
import { Logger } from "./logger";

export const createServerHandlers = (options: {
  registries: Map<RegistryUrl, RegistryNext>;
}) => {
  const { registries } = options;

  const listening = () => {
    console.log("listening");
  };

  const request: http.RequestListener = async (req, res) => {
    const request = new RequestNext(req);
    const response = new Response(res);
    const logger = new Logger();
    const adapter = new AdapterNext({ request, response, registries, logger });

    await logger.addHeader("REQUEST");
    await logger.addValue("url", request.url.value);
    await logger.addValue("registryUrl", request.url.registry ?? "");
    await handleRequest(adapter);
    await adapter.response.sendBadRequest();
    await logger.log();
  };

  return { listening, request };
};
