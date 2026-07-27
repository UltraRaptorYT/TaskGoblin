import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const vitestEntrypoint = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [
    vitestEntrypoint,
    "run",
    "tests/project-event-openai-evaluation.test.ts",
    "--reporter=verbose",
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, RUN_OPENAI_EVAL: "1" },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
