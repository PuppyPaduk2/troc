import { program } from "commander";
import * as fs from "fs";
import * as path from "path";

import * as pkg from "../../package.json";
import { createServerWithoutAuth } from "../server";
import { getDirHash } from "../utils/dir-hash";
import { getPort } from "../utils/net";
import {
  getPath as getPathConfig,
  read as readConfig,
  write as writeConfig,
} from "./config/fs";
import { remove as removeLinks, set as setLinks } from "./config/links";
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

const configCommand = program.command("config");

configCommand
  .command("create")
  .alias("cr")
  .addOption(options.configPath)
  .addOption(options.setPackages)
  .addOption(options.setNpmrc)
  .addOption(options.setRegistries)
  .addOption(options.setLinks)
  .addOption(options.write)
  .addOption(options.print)
  .action(
    async (
      options: Options["configPath"] &
        Options["setPackages"] &
        Options["setNpmrc"] &
        Options["setRegistries"] &
        Options["setLinks"] &
        Options["write"] &
        Options["print"]
    ) => {
      const config = await readConfig(options.config);
      if (options.packages) await setPackages(config);
      if (options.npmrc) await setNpmrc(config);
      if (options.registries) await setRegistries(config);
      if (options.links) await setLinks(config);
      if (options.write) await writeConfig(options.config, config);
      if (options.print) console.log(JSON.stringify(config, null, 2), "\n");

      console.log("Config path:", getPathConfig(options.config));
    }
  );

configCommand
  .command("reset")
  .alias("rs")
  .addOption(options.configPath)
  .addOption(options.setPackages)
  .addOption(options.setNpmrc)
  .addOption(options.setRegistries)
  .addOption(options.setLinks)
  .addOption(options.write)
  .addOption(options.print)
  .action(
    async (
      options: Options["configPath"] &
        Options["setPackages"] &
        Options["setNpmrc"] &
        Options["setRegistries"] &
        Options["setLinks"] &
        Options["write"] &
        Options["print"]
    ) => {
      const config = await readConfig(options.config);
      if (options.packages) await removePackages(config);
      if (options.npmrc) await removeNpmrc(config);
      if (options.registries) await removeRegistries(config);
      if (options.links) await removeLinks(config);
      if (options.write) await writeConfig(options.config, config);
      if (options.print) console.log(JSON.stringify(config, null, 2), "\n");

      console.log("Config path:", getPathConfig(options.config));
    }
  );

program
  .command("install")
  .alias("i")
  .addOption(options.configPath)
  .action(async (options: Options["configPath"]) => {
    const config = await readConfig(options.config);
    await setPackages(config);
    await setNpmrc(config);
    await setRegistries(config);
    await setLinks(config);
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
    await removeLinks(config);
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

program
  .command("watch")
  .addOption(options.configPath)
  .action(async (options: Options["configPath"]) => {
    const config = await readConfig(options.config);
    const packages = Object.entries(config.packages);

    packages.forEach(async ([, meta]) => {
      const dirHash = await getDirHash(meta.dir);

      fs.watch(meta.dir, { recursive: true }, async (_, filename) => {
        const filePath = path.resolve(meta.dir, filename);
        const changed = await dirHash.calcFileHash(filePath);
        if (changed) {
          console.log(filePath, dirHash.files[filePath]);
        }
      });
    });
  });

program.version(pkg.version).parse(process.argv);
