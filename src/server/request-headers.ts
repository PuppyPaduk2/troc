import * as http from "http";

export class RequestHeaders {
  private _headers: http.IncomingHttpHeaders;

  constructor(headers: http.IncomingHttpHeaders) {
    this._headers = headers;
  }

  public get referer(): string | null {
    return this._headers.referer ?? null;
  }

  public get npmSession(): string | null {
    const { getHeader } = RequestHeaders;
    return getHeader(this._headers["npm-session"]);
  }

  public get authorization(): string | null {
    return this._headers.authorization ?? null;
  }

  public get host(): string | null {
    return this._headers.host ?? null;
  }

  public get token(): string | null {
    const auth = this.authorization?.split(" ");
    return auth ? auth[1] ?? auth[0] ?? null : null;
  }

  public get npmCommand(): string | null {
    return this.referer?.split(" ")[0] ?? null;
  }

  static getHeader(value?: string | string[], index = 0): string | null {
    if (Array.isArray(value)) return value[index] ?? null;
    return value ?? null;
  }
}
