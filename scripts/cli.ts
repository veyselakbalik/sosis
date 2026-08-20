#!/usr/bin/env node
/**
 * Local Sosis CLI. Used to add or remove App Store Connect API keys without
 * putting .p8 contents into an agent transcript.
 */
import { addAccountFromP8File, removeAccountById } from "../src/lib/storage/account-setup.js";
import { getAccounts } from "../src/lib/server/session.js";
import { publicView } from "../src/lib/storage/accounts-file.js";

const HELP = `Sosis — local App Store Connect MCP

Usage:
  npm run sosis -- accounts list
  npm run sosis -- accounts add --label NAME --issuer-id UUID --key-id KEY --p8 ./AuthKey.p8
  npm run sosis -- accounts remove --id ACCOUNT_ID --yes
  npm run sosis -- doctor
  npm run sosis -- help

The add command reads the .p8 file from disk and encrypts it locally.
It never prints the private key.
`;

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function flag(flags: Record<string, string | boolean>, name: string): string {
  const value = flags[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

async function accountsList(): Promise<void> {
  const accounts = (await getAccounts()).map(publicView);
  process.stdout.write(`${JSON.stringify({ accounts }, null, 2)}\n`);
}

async function accountsAdd(argv: string[]): Promise<void> {
  const flags = parseFlags(argv);
  const account = await addAccountFromP8File({
    label: flag(flags, "label"),
    issuerId: flag(flags, "issuer-id"),
    keyId: flag(flags, "key-id"),
    p8Path: flag(flags, "p8"),
  });
  process.stdout.write(`${JSON.stringify({ account }, null, 2)}\n`);
}

async function accountsRemove(argv: string[]): Promise<void> {
  const flags = parseFlags(argv);
  if (flags.yes !== true) {
    throw new Error("Refusing to delete a local account without --yes");
  }
  const account = await removeAccountById(flag(flags, "id"));
  process.stdout.write(`${JSON.stringify({ removed: account }, null, 2)}\n`);
}

async function doctor(): Promise<void> {
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/mcp-doctor.ts"], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  const code: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) process.exitCode = code;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [command, subcommand, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }

  if (command === "doctor") {
    await doctor();
    return;
  }

  if (command === "accounts") {
    if (subcommand === "list") {
      await accountsList();
      return;
    }
    if (subcommand === "add") {
      await accountsAdd(rest);
      return;
    }
    if (subcommand === "remove") {
      await accountsRemove(rest);
      return;
    }
  }

  process.stderr.write(HELP);
  throw new Error(`Unknown command: ${argv.join(" ")}`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
