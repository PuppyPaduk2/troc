import { MatchFunction } from "path-to-regexp";

import { AdapterNext } from "../adapter-next";

export type AdapterHandler<Result = void> = (
  adapter: AdapterNext
) => Promise<Result>;

export type AdapterHandlers = [MatchFunction, AdapterHandler][];
