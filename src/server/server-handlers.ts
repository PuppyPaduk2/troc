import * as http from "http";
import { Adapter } from "./adapter";
import { handleRequest } from "./handlers";
import { Registry, RegistryUrl } from "./registry";
import { Request } from "./request";
import { Response } from "./response";

export const createServerHandlers = (options: {
  registries: Map<RegistryUrl, Registry<Adapter>>;
}) => {
  const { registries } = options;

  const listening = () => {
    console.log("listening");
  };

  const request: http.RequestListener = async (req, res) => {
    const request = new Request(req);
    const response = new Response(res);
    const adapter = new Adapter({ request, response, registries });

    console.log("request >");
    console.log("         ", "method:          ", request.method);
    console.log("         ", "url:             ", request.url.href);
    console.log(
      "         ",
      "registryUrl:     ",
      request.registryUrl.slice(-48)
    );
    console.log("         ", "apiVersion:      ", request.apiVersion);
    console.log("         ", "apiPath:         ", request.apiPath);
    console.log(
      "         ",
      "registryDir:     ",
      adapter.registry?.dir.slice(-48)
    );
    console.log("         ", "registry.isProxy:", adapter.registry?.isProxy);
    console.log("         ", "token:           ", request.token.slice(-48));
    console.log("         ", "isCorrectToken:  ", await adapter.isCorrectToken);
    console.log("         ", "npmCommand:      ", request.npmCommand);
    console.log("         ", "pkgScope:        ", request.pkgScope);
    console.log("         ", "pkgName:         ", request.pkgName);
    console.log();

    await handleRequest(adapter);
  };

  return { listening, request };
};
