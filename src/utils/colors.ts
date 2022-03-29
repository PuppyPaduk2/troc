import { Color } from "colors";
import * as colorsPkg from "colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _colors: any = colorsPkg;
export const colors: Color = _colors.default;
