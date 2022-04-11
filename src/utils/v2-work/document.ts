export class Document<Schema extends object> {
  private initial: Schema;
  private history: Partial<Schema>[];
  private current: Schema;

  constructor(initial: Schema, history: Partial<Schema>[]) {
    this.initial = initial;
    this.history = history;
    this.current = this.calculate();
  }

  public calculate(): Schema {
    const current: Schema = Object.assign({}, this.initial);
    this.history.forEach((item) => Object.assign(current, item));
    this.current = current;
    return current;
  }

  public set(data: Partial<Schema>): void {
    Object.assign(this.current, data);
    this.history.push(data);
  }

  public get<Key extends keyof Schema>(key: Key): Schema[Key] {
    return this.current[key];
  }

  public build(): [Schema, Partial<Schema>[]] {
    return [this.initial, this.history];
  }
}

// type User = {
//   name: string;
//   password: string;
//   email: string;
//   age: number;
// };

// const user = new Document<User>({ name: "", password: "", email: "", age: 0 });

// user.set({ name: "Bob", age: new Date().getTime() });

// const name = user.get("name");
// const age = user.get("age");
