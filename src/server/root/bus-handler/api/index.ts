import { Bus } from "../../bus";
import { bothAuth } from "./both-auth";
import { withAuth } from "./with-auth";
import { withoutAuth } from "./without-auth";

export const api = Bus.pipe([
  async (bus) => await bothAuth(bus),
  async (bus) => {
    if (await bus.isCorrectToken) await withAuth(bus);
    else await withoutAuth(bus);
  },
]);
