import { Document } from "./document";

export class Folder<Schema extends object> {
  private documents: Document<Schema>[];

  constructor(initial: [Schema, Partial<Schema>[]][]) {
    this.documents = initial.map((item) => new Document(...item));
  }

  public build(): [Schema, Partial<Schema>[]][] {
    return this.documents.map((document) => document.build());
  }
}

// type User = {
//   name: string;
//   password: string;
//   email: string;
//   age: number;
// };

// const initUser: User = { name: "", password: "", email: "", age: 0 };

// const folderUsers = new Folder<User>([
//   [initUser, [{ name: "asd" }]],
//   [initUser, [{ password: "123456" }]],
//   [initUser, [{ age: 20 }]],
//   [initUser, [{ name: "asd", password: "123456" }, { age: 10 }, { age: 30 }]],
// ]);

// const dataUsers = folderUsers.build();
