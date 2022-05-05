import { ServerResponse, IncomingHttpHeaders } from "http";

type SendParams = {
  statusCode: number;
  headers?: IncomingHttpHeaders;
  data?: Buffer | string;
  end?: Buffer | string;
};

export class Response {
  private _res: ServerResponse;
  protected _closed = false;

  constructor(res: ServerResponse) {
    this._res = res;
  }

  public get closed(): boolean {
    return this._closed;
  }

  public async send(params: SendParams): Promise<void> {
    if (this.closed) return;

    this._closed = true;
    this._res.writeHead(params.statusCode, params.headers);
    if (params.data) this._res.write(params.data);
    this._res.end(params.end);
  }

  public async sendOk(params?: Partial<SendParams>): Promise<void> {
    await this.send({ statusCode: 200, ...params });
  }

  public async sendBadRequest(params?: Partial<SendParams>): Promise<void> {
    await this.send({ statusCode: 400, end: "Bad request", ...params });
  }

  public async sendUnauthorized(params?: Partial<SendParams>): Promise<void> {
    await this.send({ statusCode: 401, end: "Unauthorized", ...params });
  }

  public async sendNotFound(params?: Partial<SendParams>): Promise<void> {
    await this.send({ statusCode: 404, end: "Not found", ...params });
  }

  public async sendServiceUnavailable(
    params?: Partial<SendParams>
  ): Promise<void> {
    await this.send({ statusCode: 503, end: "Service unavailable", ...params });
  }
}
