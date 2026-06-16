import { runServer } from "../src/server.js";

export async function runServe(): Promise<void> {
  try {
    await runServer();
  } catch (e: any) {
    process.stderr.write(`agentflow-mcp serve failed: ${e?.message ?? String(e)}\n`);
    process.exit(1);
  }
}
