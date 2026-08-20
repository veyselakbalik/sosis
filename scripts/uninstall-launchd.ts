#!/usr/bin/env node
import { unlink, access } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const LABEL = "com.sosis.app";

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function main(): Promise<void> {
  const plistPath = join(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);
  const uid = userInfo().uid;

  if (await exists(plistPath)) {
    try {
      execSync(`launchctl bootout gui/${uid} ${plistPath}`, { stdio: "pipe" });
      console.log("✓ Service stopped.");
    } catch (e) {
      console.warn(`launchctl bootout failed (may already be stopped): ${(e as Error).message}`);
    }
    await unlink(plistPath);
    console.log(`✓ plist removed: ${plistPath}`);
  } else {
    console.log("plist not found — already uninstalled.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
