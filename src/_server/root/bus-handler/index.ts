import { Bus } from "../bus";
import { api } from "./api";
import { npmCommand } from "./npm-command";

export const busHandler = Bus.pipe([
  async (bus) => {
    if (!bus.registry) await bus.sendBadRequest();
    else if (bus.apiVersion) await api(bus);
    else if (bus.npmCommand) await npmCommand(bus);
    await bus.sendNotFound();
  },
]);
