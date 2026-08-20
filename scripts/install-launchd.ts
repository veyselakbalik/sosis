#!/usr/bin/env node
import { writeFile, mkdir, access, readFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, execSync } from "node:child_process";

const LABEL = "com.sosis.app";
const DEFAULT_PORT = 3737;

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

function findNode(): string {
  try {
    const p = execSync("which node", { encoding: "utf8" }).trim();
    if (p) return p;
  } catch {}
  return process.execPath;
}

const SOSIS_DIR = ".sosis";
const LEGACY_DIR = ".easyapp";

async function readConfig(): Promise<{ port: number }> {
  // Prefer the current Sosis location; fall back to the legacy easyapp path
  // for users upgrading from older installs (paths.ts still reads that path
  // as a one-shot migration source).
  for (const dir of [SOSIS_DIR, LEGACY_DIR]) {
    const cfgPath = join(homedir(), dir, "config.json");
    if (await fileExists(cfgPath)) {
      try {
        const raw = await readFile(cfgPath, "utf8");
        const parsed = JSON.parse(raw) as { port?: number };
        if (parsed.port && Number.isInteger(parsed.port)) return { port: parsed.port };
      } catch {}
    }
  }
  return { port: DEFAULT_PORT };
}

function isPortInUse(port: number): boolean {
  try {
    execFileSync("lsof", ["-i", `:${port}`], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd());
  const serverFile = join(repoRoot, ".next/standalone/server.js");
  const staticDir = join(repoRoot, ".next/static");
  const standaloneStaticDir = join(repoRoot, ".next/standalone/.next/static");

  if (!(await fileExists(serverFile))) {
    console.error("✗ .next/standalone/server.js not found. Run `npm run build` first.");
    process.exit(1);
  }

  // Next.js standalone build asla static/ ve public/'ı kendisi kopyalamaz.
  // Her setup'ta koşulsuz senkronla — aksi halde rebuild sonrası bayat
  // static dosyalar kalır ve CSS 404 düşer (sayfa plain HTML görünür).
  await mkdir(join(repoRoot, ".next/standalone/.next"), { recursive: true });
  execSync(`rm -rf "${standaloneStaticDir}"`);
  execSync(`cp -R "${staticDir}" "${join(repoRoot, ".next/standalone/.next/")}"`);
  const publicDir = join(repoRoot, "public");
  const standalonePublic = join(repoRoot, ".next/standalone/public");
  if (await fileExists(publicDir)) {
    execSync(`rm -rf "${standalonePublic}"`);
    execSync(`cp -R "${publicDir}" "${join(repoRoot, ".next/standalone/")}"`);
  }

  const { port } = await readConfig();
  if (isPortInUse(port)) {
    console.error(`✗ Port ${port} is in use. Set a different port in ~/${SOSIS_DIR}/config.json.`);
    process.exit(1);
  }

  const logsDir = join(homedir(), SOSIS_DIR, "logs");
  await mkdir(logsDir, { recursive: true, mode: 0o700 });
  const stdoutPath = join(logsDir, "stdout.log");
  const stderrPath = join(logsDir, "stderr.log");

  const node = findNode();
  const agentsDir = join(homedir(), "Library/LaunchAgents");
  await mkdir(agentsDir, { recursive: true });
  const plistPath = join(agentsDir, `${LABEL}.plist`);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${serverFile}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${join(repoRoot, ".next/standalone")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${port}</string>
    <key>HOSTNAME</key>
    <string>127.0.0.1</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${stdoutPath}</string>
  <key>StandardErrorPath</key>
  <string>${stderrPath}</string>
</dict>
</plist>
`;

  await writeFile(plistPath, plist, { mode: 0o644 });
  console.log(`✓ plist written: ${plistPath}`);

  const uid = userInfo().uid;
  try {
    execSync(`launchctl bootout gui/${uid} ${plistPath}`, { stdio: "pipe" });
  } catch {}
  try {
    execSync(`launchctl bootstrap gui/${uid} ${plistPath}`, { stdio: "pipe" });
    console.log(`✓ Service loaded (gui/${uid})`);
  } catch (e) {
    console.error(`launchctl bootstrap failed: ${(e as Error).message}`);
    process.exit(1);
  }

  console.log(`\nSosis should be running at http://localhost:${port}`);
  console.log(`Logs: ${logsDir}`);
  console.log(`\nTo uninstall: npm run uninstall`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
