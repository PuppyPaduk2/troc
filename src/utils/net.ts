import { Server } from "net";

export async function getPort(startPort: number): Promise<number> {
  for (let port = startPort; port < 65535; port += 1) {
    if (await checkPort(port)) {
      return port;
    }
  }

  throw new Error("Incorrect port");
}

function checkPort(port: number, hostname?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = new Server();

    server.on("error", () => {
      resolve(false);
    });

    server.on("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, hostname);
  });
}
