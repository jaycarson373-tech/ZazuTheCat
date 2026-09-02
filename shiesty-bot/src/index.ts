import "dotenv/config";

import { setTimeout as sleep } from "node:timers/promises";

import { loadConfig } from "./config.js";
import { errorSummary, log } from "./logger.js";
import { OpenAiShiestyTransformer } from "./openai.js";
import { SupabaseInteractionStore } from "./storage.js";
import { runCycle } from "./worker.js";
import { TwitterGateway } from "./x.js";

let stopping = false;

function requestStop(signal: string): void {
  stopping = true;
  log("worker.stop_requested", { signal });
}

process.once("SIGINT", () => requestStop("SIGINT"));
process.once("SIGTERM", () => requestStop("SIGTERM"));

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const config = loadConfig();
  const x = new TwitterGateway(config);
  const store = new SupabaseInteractionStore(config);
  const transformer = new OpenAiShiestyTransformer(config);

  await x.verifyIdentity();
  log("worker.started", {
    botProject: config.botProject,
    botUserId: config.botUserId,
    dryRun: config.dryRun,
    model: config.openaiImageModel
  });

  do {
    try {
      await runCycle(config, { store, x, transformer });
    } catch (error) {
      log("cycle.failed", errorSummary(error));
    }
    if (once || stopping) break;
    await sleep(config.pollIntervalMs);
  } while (!stopping);
}

main().catch((error) => {
  log("worker.fatal", errorSummary(error));
  process.exitCode = 1;
});
