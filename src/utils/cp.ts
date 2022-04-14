import * as cp from "child_process";

export type SpawnResult = {
  stdoutData: Buffer[];
  stderrData: Buffer[];
  closeCode: number | null;
};

export async function spawn(
  ...args: Parameters<typeof cp.spawn>
): Promise<SpawnResult> {
  return new Promise<SpawnResult>((resolve) => {
    const child = cp.spawn(...args);
    const stdoutData: SpawnResult["stdoutData"] = [];
    const stderrData: SpawnResult["stderrData"] = [];

    child.stdout?.on("data", (data) => stdoutData.push(data));
    child.stderr?.on("data", (data) => stderrData.push(data));
    child.on("close", (closeCode) =>
      resolve({ stdoutData, stderrData, closeCode })
    );
  });
}
