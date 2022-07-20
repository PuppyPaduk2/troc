import { createOption as createOptionCommander, Option } from "commander";
import { resolve } from "path";

export const createOption = (
  option: { flags: Option["flags"] } & Partial<Omit<Option, "flags">>
): Option => {
  return Object.assign(createOptionCommander(option.flags), option);
};

export type Options = {
  configPath: { config: string };
  setPackages: { packages: boolean };
  setNpmrc: { npmrc: boolean };
  setRegistries: { registries: boolean };
  setLinks: { links: boolean };
  write: { write: boolean };
  print: { print: boolean };
};

export const options: Record<keyof Options, Option> = {
  configPath: createOption({
    flags: "-c, --config <path>",
    description: "Path to config file",
    defaultValue: resolve(__dirname, "config.json"),
  }),
  setPackages: createOption({
    flags: "--no-packages",
    description: "Setup packages",
    defaultValue: true,
  }),
  setNpmrc: createOption({
    flags: "--no-npmrc",
    description: "Setup npmrc",
    defaultValue: true,
  }),
  setRegistries: createOption({
    flags: "--no-registries",
    description: "Setup registries",
    defaultValue: true,
  }),
  setLinks: createOption({
    flags: "--no-links",
    description: "Setup links",
    defaultValue: true,
  }),
  write: createOption({
    flags: "--no-write",
    description: "No write to config",
    defaultValue: true,
  }),
  print: createOption({
    flags: "-p, --print",
    description: "Print in terminal",
    defaultValue: false,
  }),
};
