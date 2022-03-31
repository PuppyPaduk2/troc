import * as crypto from "crypto";

export function generateToken(): string {
  return crypto.createHmac("sha256", crypto.randomBytes(64)).digest("hex");
}
