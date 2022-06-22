import { createServerWithoutAuthN } from "./server";
import { getPort } from "./utils/net";

const { server } = createServerWithoutAuthN({
  storageDir: "./storage-root",
  registries: [
    {
      path: "",
      dir: "./__root__",
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
    },
    {
      path: "/protected",
      dir: "./protected",
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
    },
    {
      path: "/protected/my",
      dir: "./protected-my",
      proxies: [],
    },
    {
      path: "/custom",
      dir: "./custom",
      proxies: [],
    },
    {
      path: "/custom-next-0",
      dir: "./custom-next-0",
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
    },
  ],
  requestEventHandlers: {
    before: [
      // async (event) => {
      //   console.log(event);
      // },
    ],
    after: [],
  },
});

getPort(4000).then((port) => {
  server.addListener("listening", () => {
    console.log("Listening http://localhost:" + port);
  });
  server.listen(port);
});
