import { ServerResponse, IncomingHttpHeaders } from "http";

export type SendParams = {
  statusCode: number;
  headers?: IncomingHttpHeaders;
  data?: Buffer | string;
  end?: Buffer | string;
};

export class ResponseMeta {
  private _isResponse = false;
  private original: ServerResponse;

  constructor(response: ServerResponse) {
    this.original = response;
  }

  public get isResponse(): boolean {
    return this._isResponse;
  }

  public async send(params: SendParams): Promise<void> {
    if (this.isResponse) return;

    this._isResponse = true;
    this.original.writeHead(params.statusCode, params.headers);
    if (params.data) this.original.write(params.data);
    this.original.end(params.end);
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
