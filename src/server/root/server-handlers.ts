import * as http from "http";
import { Bus } from "./bus";
import { busHandler } from "./bus-handler";
import { Registry, RegistryUrl } from "./registry";

export const createServerHandlers = (options: {
  registries: Map<RegistryUrl, Registry>;
}) => {
  const { registries } = options;

  const listening = () => {
    console.log("listening");
  };

  const request: http.RequestListener = async (req, res) => {
    const bus = new Bus({ req, res, registries });

    console.log("request >");
    console.log("         ", "method:          ", bus.method);
    console.log("         ", "url:             ", bus.url.href);
    console.log("         ", "registryUrl:     ", bus.registryUrl.slice(-48));
    console.log("         ", "apiVersion:      ", bus.apiVersion);
    console.log("         ", "apiPath:         ", bus.apiPath);
    console.log("         ", "registryDir:     ", bus.registry?.dir.slice(-48));
    console.log("         ", "registry.isProxy:", bus.registry?.isProxy);
    console.log("         ", "token:           ", bus.token.slice(-48));
    console.log("         ", "isCorrectToken:  ", await bus.isCorrectToken);
    console.log("         ", "npmCommand:      ", bus.npmCommand);
    console.log("         ", "pkgScope:        ", bus.pkgScope);
    console.log("         ", "pkgName:         ", bus.pkgName);
    console.log();

    await busHandler(bus);
  };

  return { listening, request };
};
