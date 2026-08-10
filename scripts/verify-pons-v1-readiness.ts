import {
  evaluatePonsV1Readiness,
  loadPonsV1ReadinessConfig,
  readPonsV1ReadinessSnapshot,
  sanitizeReadinessDiagnostic,
  VAULT_TRUST_NOTICE,
} from "../keeper/pons-v1-readiness";

async function main(): Promise<void> {
  try {
    const config = loadPonsV1ReadinessConfig();
    const snapshot = await readPonsV1ReadinessSnapshot(config);
    const report = evaluatePonsV1Readiness(config, snapshot);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          readOnly: true,
          ok: false,
          trustNotice: VAULT_TRUST_NOTICE,
          fatal: sanitizeReadinessDiagnostic(error),
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  }
}

void main();
