export enum NpmCommand {
  adduser = "adduser",
  whoami = "whoami",
  logout = "logout",
  publish = "publish",
  view = "view",
  install = "install",
}

const npmCommands: Record<string, NpmCommand> = {
  adduser: NpmCommand.adduser,
  whoami: NpmCommand.whoami,
  logout: NpmCommand.logout,
  publish: NpmCommand.publish,
  view: NpmCommand.view,
  install: NpmCommand.install,
};

export const parseNpmCommand = (referer?: string): NpmCommand | null => {
  const rawCommand = referer?.split(" ")[0] ?? "";
  return npmCommands[rawCommand] ?? null;
};
