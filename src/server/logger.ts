import chalk from "chalk";

type ItemBase<T> = { label: string; time: number } & T;

type Item =
  | ItemBase<{ type: "header" }>
  | ItemBase<{ type: "title" }>
  | ItemBase<{ type: "block" }>
  | ItemBase<{ type: "value"; value: string }>;

const { bgYellow, bgCyan, bgGrey, bold, italic, red } = chalk;

export class Logger {
  private _items: Item[] = [];
  private _maxLabelLength = 0;

  public get length(): number {
    return this._items.length;
  }

  private async _logItem(item: Item, prev: Item | null): Promise<void> {
    const values = [];
    const label = item.label.padEnd(this._maxLabelLength);
    if (item.type === "header") values.push(bgYellow(label));
    if (item.type === "title") values.push(bgCyan(label));
    if (item.type === "block") values.push(bgGrey(label));
    if (item.type === "value") {
      values.push(bold(label), italic(item.value));
    }
    if (prev) {
      const sec = (item.time - prev.time) / 1000;
      if (sec > 0.3) values.push(red(sec + "s"));
      else values.push(sec + "s");
    }
    console.log(...values);
  }

  private _getTime(): number {
    return new Date().getTime();
  }

  public async addItem(item: Item): Promise<void> {
    const labelLength = item.label.length;
    if (this._maxLabelLength < labelLength) this._maxLabelLength = labelLength;
    this._items.push(item);
  }

  public async addHeader(label: string): Promise<void> {
    const time = this._getTime();
    await this.addItem({ type: "header", label, time });
  }

  public async addTitle(label: string): Promise<void> {
    const time = this._getTime();
    await this.addItem({ type: "title", label, time });
  }

  public async addBlock(label: string): Promise<void> {
    const time = this._getTime();
    await this.addItem({ type: "block", label, time });
  }

  public async addValue(label: string, value: string): Promise<void> {
    const time = this._getTime();
    await this.addItem({ type: "value", label, time, value });
  }

  public async log(): Promise<void> {
    const { values, all } = this._items.reduce<{ values: Item[]; all: Item[] }>(
      (memo, item) => {
        if (item.type === "value") memo.values.push(item);
        else memo.all.push(item);
        return memo;
      },
      { values: [], all: [] }
    );
    for (let index = 0; index < all.length; index += 1) {
      const prev = all[index - 1] ?? null;
      const curr = all[index];
      await this._logItem(curr, prev);
    }
    for (const item of values) await this._logItem(item, null);
  }
}
