import { Registry, RegistryUrl } from "./registry";
import { RequestParams } from "./request";
import { Response, ResponseParams } from "./response";

export type BusHandler = (bus: Bus) => Promise<void>;

export type BusParams = {
  registries: Map<RegistryUrl, Registry>;
};

export class Bus extends Response {
  private registries: Map<RegistryUrl, Registry>;

  constructor(options: RequestParams & ResponseParams & BusParams) {
    super(options);
    this.registries = options.registries;
  }

  public get registry(): Registry | null {
    return this.registries.get(this.registryUrl) ?? null;
  }

  public get isCorrectToken(): Promise<boolean> {
    const token = this.token;

    return (
      this.registry?.getToken(token).then((tokenData) => !!tokenData) ??
      Promise.resolve(false)
    );
  }

  public get proxyUrls(): string[] {
    if (!this.registry) return [];
    return [];
  }

  static pipe(handlers: BusHandler[]): BusHandler {
    return async (bus) => {
      let result = Promise.resolve();

      for (const handler of handlers.filter(Boolean)) {
        await result;
        if (bus.isAnswered) break;
        result = handler(bus);
      }

      await result;
    };
  }
}
