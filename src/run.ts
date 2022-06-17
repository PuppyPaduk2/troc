import * as http from "http";
import * as path from "path";

import {
  createRequestEventHandler,
  createRequestHandler,
  RequestEventHandler,
  requestEventHandlers,
} from "./server-next";
import { logTimeMs } from "./utils/log";
import { getPort } from "./utils/net";
import { createRegistry } from "./utils/registry";

const server = http.createServer();
const dir = path.join(__dirname, "storage-root");
const registries = {
  root: createRegistry({
    path: "",
    dir: path.join(dir, "__root__"),
    proxies: [
      {
        url: "https://registry.npmjs.org",
        include: [
          "/(install|view)/(.*)",
          "/(install|view)/p3",
          "/(install|view)/@my/p3",
        ],
        exclude: ["/(install|view)/p1", "/(install|view)/@my/(.*)"],
      },
      {
        url: "http://localhost:4000/protected",
        include: [
          "/(install|view)/p1",
          "/(install|view)/@my/(.*)",
          "/(install|view)/p3",
        ],
      },
    ],
  }),
  protected: createRegistry({
    path: "/protected",
    dir: path.join(dir, "protected"),
    proxies: [
      {
        url: "https://registry.npmjs.org",
        include: [
          "/(install|view)/(.*)",
          "/(install|view)/p3",
          "/(install|view)/@my/p3",
        ],
        exclude: ["/(install|view)/p1", "/(install|view)/@my/(.*)"],
      },
      {
        url: "http://localhost:4000/custom",
        include: [
          "/(install|view|publish)/p1",
          "/(install|view|publish)/@my/(.*)",
          "/(install|view|publish)/p3",
        ],
      },
    ],
  }),
  protectedMy: createRegistry({
    path: "/protected/my",
    dir: path.join(dir, "protected-my"),
    proxies: [],
  }),
  custom: createRegistry({
    path: "/custom",
    dir: path.join(dir, "custom"),
    proxies: [],
  }),
  customNext0: createRegistry({
    path: "/custom-next-0",
    dir: path.join(dir, "/custom-next-0"),
    proxies: [
      {
        url: "https://registry.npmjs.org",
        include: [
          "/(install|view)/(.*)",
          "/(install|view)/p3",
          "/(install|view)/@my/p3",
        ],
        exclude: ["/(install|view)/p1", "/(install|view)/@my/(.*)"],
      },
      {
        url: "http://localhost:4000/custom",
        include: [
          "/(install|view|publish)/p1",
          "/(install|view|publish)/@my/(.*)",
          "/(install|view|publish)/p3",
        ],
      },
    ],
  }),
};

const auth: RequestEventHandler = async (event) => {
  // console.log(event);
  // return sendNotFound(response);
};

getPort(4000).then((port) => {
  server.addListener("listening", () => {
    console.log("Listening http://localhost:" + port);
  });
  const baseRequestEventHandler = createRequestEventHandler({
    ...requestEventHandlers.view,
    ...requestEventHandlers.install,
    ...requestEventHandlers.publish,
  });
  const requestHandler = createRequestHandler({
    registries: Object.values(registries),
    requestEventHandlers: [
      auth,
      async (...args) => {
        return logTimeMs(args[0].key.value, baseRequestEventHandler)(...args);
      },
    ],
  });
  server.addListener("request", requestHandler);
  server.listen(port);
});
