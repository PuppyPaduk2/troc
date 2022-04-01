import * as pkg from "prompts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _pkg: any = pkg;
export const prompts: typeof pkg = _pkg.default;
