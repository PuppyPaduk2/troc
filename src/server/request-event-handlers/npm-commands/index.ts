import { createHandler } from "../../../utils/request-event-handler";
import { installHandlers } from "./install";
import { publishHandlers } from "./publish";
import { viewHandlers } from "./view";

export const npmCommandHandlers = createHandler({
  ...viewHandlers,
  ...installHandlers,
  ...publishHandlers,
});
