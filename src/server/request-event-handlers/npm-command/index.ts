import { installHandlers } from "./install";
import { publishHandlers } from "./publish";
import { viewHandlers } from "./view";

export const npmCommandHandlers = {
  install: installHandlers,
  view: viewHandlers,
  publish: publishHandlers,
};
