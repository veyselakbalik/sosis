#!/usr/bin/env node

import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { getAccount, getAccounts } from "../src/lib/server/session.js";
import { listAsoSkills } from "../src/lib/core/aso-skills.js";
import {
  appDir,
  backupAssetsDir,
  backupRecordsDir,
  changePlansDir,
  credentialsDir,
  dataPath,
  secureChangesDir,
  snapshotsDir,
} from "../src/lib/storage/paths.js";

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

function octalMode(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, "0");
}

async function checkMode(
  label: string,
  path: string,
  expected: number,
  optional = true,
): Promise<Check> {
  try {
    const value = await stat(path);
    const actual = value.mode & 0o777;
    return {
      label,
      ok: actual === expected,
      detail: `${path} mode=${octalMode(actual)} (expected ${octalMode(expected)})`,
    };
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { label, ok: true, detail: `${path} not created yet` };
    }
    return { label, ok: false, detail: `${path}: ${(error as Error).message}` };
  }
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    label: "Node.js",
    ok: major >= 20,
    detail: `${process.version} (requires 20+)`,
  });
  checks.push({
    label: "Platform",
    ok: process.platform === "darwin",
    detail: `${process.platform} (macOS Keychain is required)`,
  });

  const accounts = await getAccounts();
  checks.push({
    label: "ASC accounts",
    ok: accounts.length > 0,
    detail: accounts.length > 0
      ? `${accounts.length} configured`
      : "none configured; create a Team API key in App Store Connect (Users and Access → Integrations), then run npm run sosis -- accounts add --label NAME --issuer-id UUID --key-id KEY --p8 ./AuthKey.p8",
  });

  for (const account of accounts) {
    try {
      const resolvedAccount = await getAccount(account.id);
      checks.push({
        label: `Credential: ${account.label}`,
        ok: Boolean(resolvedAccount?.p8),
        detail: resolvedAccount?.p8 ? "encrypted credential decrypted successfully" : "credential missing",
      });
    } catch (error) {
      checks.push({
        label: `Credential: ${account.label}`,
        ok: false,
        detail: (error as Error).message,
      });
    }
  }

  checks.push(await checkMode("Sosis data directory", appDir(), 0o700));
  checks.push(await checkMode("Account metadata", dataPath(), 0o600));
  checks.push(await checkMode("Credentials directory", credentialsDir(), 0o700));
  checks.push(await checkMode("Change plans", changePlansDir(), 0o700));
  checks.push(await checkMode("Snapshots", snapshotsDir(), 0o700));
  checks.push(await checkMode("Secure changes", secureChangesDir(), 0o700));
  checks.push(await checkMode("Backup records", backupRecordsDir(), 0o700));
  checks.push(await checkMode("Backup assets", backupAssetsDir(), 0o700));

  try {
    await access(resolve("node_modules", "@modelcontextprotocol", "sdk"));
    checks.push({ label: "MCP SDK", ok: true, detail: "installed" });
  } catch {
    checks.push({ label: "MCP SDK", ok: false, detail: "missing; run npm install" });
  }

  try {
    const asoSkills = await listAsoSkills();
    checks.push({
      label: "ASO skill library",
      ok: asoSkills.length === 40,
      detail: `${asoSkills.length} bundled skills indexed`,
    });
  } catch (error) {
    checks.push({ label: "ASO skill library", ok: false, detail: (error as Error).message });
  }

  for (const check of checks) {
    process.stdout.write(`${check.ok ? "OK" : "FAIL"}  ${check.label}: ${check.detail}\n`);
  }

  const projectPath = resolve(".");
  process.stdout.write("\nAgent command:\n");
  process.stdout.write(`npm --prefix ${JSON.stringify(projectPath)} run mcp\n`);

  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`FAIL  MCP doctor: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
