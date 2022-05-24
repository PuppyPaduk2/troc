import chalk from "chalk";

type Item =
  | { type: "header"; label: string }
  | { type: "title"; label: string }
  | { type: "block"; label: string }
  | { type: "value"; label: string; value: string };

const { bgYellow, bgCyan, bgGrey, bold, italic } = chalk;

export class Logger {
  private _items: Item[] = [];
  private _maxLabelLength = 0;

  public get length(): number {
    return this._items.length;
  }

  private async _logItem(item: Item): Promise<void> {
    const values = [];
    if (item.type === "header") values.push(bgYellow(item.label));
    if (item.type === "title") values.push(bgCyan(item.label));
    if (item.type === "block") values.push(bgGrey(item.label));
    if (item.type === "value") {
      const label = bold(item.label.padEnd(this._maxLabelLength) + ":");
      const value = italic(item.value);
      values.push(label, value);
    }
    console.log(...values);
  }

  public async addItem(item: Item): Promise<void> {
    const labelLength = item.label.length;
    if (this._maxLabelLength < labelLength) this._maxLabelLength = labelLength;
    this._items.push(item);
  }

  public async addHeader(label: string): Promise<void> {
    await this.addItem({ type: "header", label });
  }

  public async addTitle(label: string): Promise<void> {
    await this.addItem({ type: "title", label });
  }

  public async addBlock(label: string): Promise<void> {
    await this.addItem({ type: "block", label });
  }

  public async addValue(label: string, value: string): Promise<void> {
    await this.addItem({ type: "value", label, value });
  }

  public async log(): Promise<void> {
    const values: Item[] = [];
    for (const item of this._items) {
      if (item.type === "value") values.push(item);
      else await this._logItem(item);
    }
    for (const item of values) await this._logItem(item);
  }
}
