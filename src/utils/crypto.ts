import * as crypto from "crypto";

export function hmac(value: crypto.BinaryLike | crypto.KeyObject): string {
  return crypto.createHmac("sha256", value).digest("hex");
}

export function generateToken(length = 64): string {
  return hmac(crypto.randomBytes(length));
}
