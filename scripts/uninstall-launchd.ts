#!/usr/bin/env node
/**
 * Removes a leftover Sosis/EasyApp dashboard launchd agent from older installs.
 * Current Sosis is stdio MCP + CLI only; this does not touch ~/.sosis/.
 */
import { unlink, access } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const LABELS = ["com.sosis.app", "com.easyapp.app"];

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function main(): Promise<void> {
  const uid = userInfo().uid;
  let removed = false;

  for (const label of LABELS) {
    const plistPath = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
    if (!(await exists(plistPath))) continue;
    try {
      execSync(`launchctl bootout gui/${uid} ${plistPath}`, { stdio: "pipe" });
      console.log(`✓ Service stopped: ${label}`);
    } catch (e) {
      console.warn(`launchctl bootout failed for ${label} (may already be stopped): ${(e as Error).message}`);
    }
    await unlink(plistPath);
    console.log(`✓ plist removed: ${plistPath}`);
    removed = true;
  }

  if (!removed) {
    console.log("No leftover dashboard launchd agent found.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
