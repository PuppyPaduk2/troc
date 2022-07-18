import { program } from "commander";

import * as pkg from "../../package.json";
import { createServerWithoutAuth } from "../server";
import { getPort } from "../utils/net";
import {
  getPath as getPathConfig,
  read as readConfig,
  write as writeConfig,
} from "./config/fs";
import {
  attach as attachNpmrc,
  detach as detachNpmrc,
  remove as removeNpmrc,
  set as setNpmrc,
} from "./config/npmrc";
import {
  remove as removePackages,
  set as setPackages,
} from "./config/packages";
import {
  remove as removeRegistries,
  set as setRegistries,
} from "./config/registries";
import { Options, options } from "./options";

program
  .command("install")
  .alias("i")
  .addOption(options.configPath)
  .action(async (options: Options["configPath"]) => {
    console.log(getPathConfig(options.config));
    const config = await readConfig(options.config);
    await setPackages(config);
    await setNpmrc(config);
    await setRegistries(config);
    await writeConfig(options.config, config);
    await attachNpmrc(config);
  });

program
  .command("uninstall")
  .alias("un")
  .addOption(options.configPath)
  .action(async (options: Options["configPath"]) => {
    const config = await readConfig(options.config);
    await detachNpmrc(config);
    await removePackages(config);
    await removeNpmrc(config);
    await removeRegistries(config);
    await writeConfig(options.config, config);
  });

program
  .command("start")
  .addOption(options.configPath)
  .action(async (options: Options["configPath"]) => {
    const config = await readConfig(options.config);
    const { server } = createServerWithoutAuth({
      registries: Object.values(config.registries),
    });
    const port = await getPort(config.port);

    server.addListener("listening", () => {
      console.log("Listening http://localhost:" + port);
    });
    server.listen(port);
  });

program.version(pkg.version).parse(process.argv);
