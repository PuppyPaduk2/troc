import * as http from "http";

export class RequestData {
  private _req: http.IncomingMessage;
  private _body: Buffer | null = null;

  constructor(req: http.IncomingMessage) {
    this._req = req;
  }

  public async value(): Promise<Buffer> {
    this._body =
      this._body ?? (await RequestData.getIncomingMessageData(this._req));
    return this._body;
  }

  public async json<T>(def: T): Promise<T> {
    return await RequestData.toJson(await this.value(), def);
  }

  static getIncomingMessageData(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve) => {
      const data: Buffer[] = [];

      req.on("data", (chunk: Buffer) => {
        data.push(chunk);
      });

      req.on("end", () => {
        resolve(Buffer.concat(data));
      });

      req.on("error", () => {
        resolve(Buffer.from([]));
      });
    });
  }

  static async toJson<T>(value: Buffer, def: T): Promise<T> {
    try {
      return JSON.parse(value.toString());
    } catch {
      return def;
    }
  }
}
