import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const bridgeURL = new URL("../../dist/main/swiftBridge/jsonLineBridge.js", import.meta.url).href;
const runtimeURL = new URL("../../dist/main/electronShellRuntime.js", import.meta.url).href;
const protocolURL = new URL("../../dist/main/protocol/electronShellProtocol.js", import.meta.url).href;

describe("Swift Host shutdown over the process bridge", () => {
  it.each([false, true])("finishes shutdown when the host output reader is closed=%s", async (readerClosed) => {
    const result = await runShutdown(readerClosed);

    expect(result.lifecycle).toEqual(["supervisor.stopped", "app.quit"]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    if (!readerClosed) {
      expect(JSON.parse(result.stdout)).toEqual({
        channel: "electron_shell", type: "command.ack", commandId: "shutdown-1", ok: true,
      });
    }
  });

  it("keeps unexpected output failures visible", async () => {
    const result = await runShutdown(false, "EIO");

    expect(result.lifecycle).toEqual(["supervisor.stopped", "app.quit"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("write EIO");
  });
});

function runShutdown(readerClosed: boolean, outputFailure?: "EIO"): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
  lifecycle: string[];
}> {
  const source = `
    import { Writable } from "node:stream";
    import { JsonLineBridge } from ${JSON.stringify(bridgeURL)};
    import { ElectronShellRuntime } from ${JSON.stringify(runtimeURL)};
    import { parseCommand } from ${JSON.stringify(protocolURL)};
    const lifecycle = [];
    const outputFailure = ${JSON.stringify(outputFailure ?? null)};
    const output = outputFailure ? new Writable({
      write(_chunk, _encoding, callback) {
        callback(Object.assign(new Error("write " + outputFailure), { code: outputFailure }));
      },
    }) : process.stdout;
    const bridge = new JsonLineBridge({ input: process.stdin, output });
    const runtime = new ElectronShellRuntime({
      prewarmer: {}, activityWindow: {}, now: () => new Date().toISOString(),
      send: event => bridge.send(event),
      stopSupervisor: () => lifecycle.push("supervisor.stopped"),
      quit: () => {
        lifecycle.push("app.quit");
        process.send({ lifecycle });
        // Electron's app.quit completes asynchronously. Keep that boundary open
        // long enough for the real pipe's write error to reach the event loop.
        setTimeout(() => {
          process.send({ lifecycle });
          process.stdin.destroy();
          process.disconnect();
        }, 20);
      },
    });
    bridge.onLine(line => {
      void runtime.handleCommand(parseCommand(line));
    });
    process.send({ ready: true });
  `;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });
    let stdout = "";
    let stderr = "";
    let lifecycle: string[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Electron shutdown did not finish after the host disconnected"));
    }, 5_000);
    child.stdout!.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr!.on("data", chunk => { stderr += chunk.toString(); });
    child.on("message", message => {
      const value = message as { ready?: boolean; lifecycle?: string[] };
      if (value.ready) {
        if (readerClosed) child.stdout!.destroy();
        child.stdin!.end(JSON.stringify({
          channel: "electron_shell", type: "shutdown", commandId: "shutdown-1",
        }) + "\n");
      }
      if (value.lifecycle) lifecycle = value.lifecycle;
    });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr, lifecycle });
    });
  });
}
