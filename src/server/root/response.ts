import * as http from "http";
import { Request, RequestParams } from "./request";

export type ResponseParams = {
  res: http.ServerResponse;
};

type SendParams = {
  statusCode: number;
  headers?: http.IncomingHttpHeaders;
  data?: Buffer | string;
  end?: Buffer | string;
};

export class Response extends Request {
  private res: http.ServerResponse;
  protected answered: boolean;

  constructor(options: RequestParams & ResponseParams) {
    super(options);
    this.res = options.res;
    this.answered = false;
  }

  public get isAnswered(): boolean {
    return this.answered;
  }

  public async send(params: SendParams): Promise<void> {
    if (this.answered) return;

    this.answered = true;
    this.res.writeHead(params.statusCode, params.headers);
    if (params.data) this.res.write(params.data);
    this.res.end(params.end);
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
