import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";

export const requests = {
  "https:": httpsRequest,
  "http:": httpRequest,
};

export type RequestProtocol = keyof typeof requests;

export function toRequestProtocol(value?: string | null): RequestProtocol {
  if (value === "http:") return "http:";
  else if (value === "https:") return "https:";

  throw new Error("Incorrect request type");
}
