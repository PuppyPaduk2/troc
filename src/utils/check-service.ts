import { buildRequestOptions } from "./build-request-options";
import { requests, toRequestProtocol } from "./request-by-protocol";

export function checkService(url: string): Promise<{ error: Error | null }> {
  return new Promise((resolve) => {
    const params = buildRequestOptions({ url });
    const request = requests[toRequestProtocol(params.protocol)];
    const req = request(params);
    let error: Error | null = null;

    req.on("error", (_error) => (error = _error));
    req.on("close", () => resolve({ error }));
    req.end();
  });
}
