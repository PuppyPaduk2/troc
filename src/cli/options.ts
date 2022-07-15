import { createOption as createOptionCommander, Option } from "commander";
import { resolve } from "path";

export const createOption = (
  option: { flags: Option["flags"] } & Partial<Omit<Option, "flags">>
): Option => {
  return Object.assign(createOptionCommander(option.flags), option);
};

export type Options = {
  configPath: { config: string };
  writeConfig: { write: boolean };
};

export const options: Record<keyof Options, Option> = {
  configPath: createOption({
    flags: "-c, --config <path>",
    description: "Path to config file",
    defaultValue: resolve(__dirname, "config.json"),
  }),
  writeConfig: createOption({
    flags: "-w, --write",
    description: "Write to config",
    defaultValue: true,
  }),
};
