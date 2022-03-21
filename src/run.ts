import { createServer } from "./create-server";

const port = 4000;

(async () => {
  const proxy: string[] = [
    // "http://0.0.0.0:5001/npm",
    // "http://0.0.0.0:5002/npm",
    "https://registry.npmjs.org",
  ];
  const result = await createServer({ port, proxy });

  if (result instanceof Error) {
    console.log(result);
  }

  console.log(`Server created http://localhost:${port}`);
})();
