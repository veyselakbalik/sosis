# Sosis

> A local-first, agent-native control layer for App Store Connect.

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![macOS](https://img.shields.io/badge/macOS-Keychain-000000?logo=apple&logoColor=white)](https://support.apple.com/guide/keychain-access/welcome/mac)
[![MCP](https://img.shields.io/badge/MCP-stdio-5A45FF)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

Sosis lets Codex, Claude Code, Cursor, and other MCP-compatible agents inspect and manage App Store Connect through typed local tools.

The MCP server is the product. The web app is an optional visual dashboard for adding accounts, inspecting App Store state, reviewing change history, and restoring backups.

**No hosted Sosis service. No Sosis AI API key. No credentials sent to the browser.**

---

## Why Sosis?

App Store Connect work is repetitive but sensitive. A single careless bulk edit can replace every keyword, publish the wrong reply, or delete assets that are difficult to rebuild.

Sosis gives an agent the context and tools it needs while keeping the dangerous part deliberately boring:

```text
read current state
        ↓
validate the proposal
        ↓
create a plan and exact diff
        ↓
user reviews and confirms
        ↓
snapshot or backup
        ↓
write to App Store Connect
        ↓
read again and verify
```

The connected agent uses its own model to draft translations, release notes, and replies. Sosis does not embed OpenAI, Anthropic, or Gemini and does not ask for a separate model API key.

## What can it do?

- Browse apps, versions, builds, localizations, reviews, TestFlight groups, testers, subscriptions, offers, screenshots, and App Previews.
- Localize App Store metadata with the host agent's model across many locales.
- Load 40 bundled ASO specialist workflows for keyword research, metadata, competitors, creative, reviews, growth, monetization, and market intelligence.
- Copy exact metadata from an older App Store version into a protected batch plan.
- Plan, apply, verify, audit, and restore metadata changes.
- Protect App Info, subscription copy, TestFlight “What to Test,” and App Review details.
- Upload screenshot directories using locale/display folder conventions.
- Back up screenshots and localizations before deletion, then restore them later.
- Manage builds, review submission, release, phased release, subscriptions, and TestFlight operations with explicit write confirmation.
- Show recent changes and deletion backups in the optional local dashboard.

## Architecture

```text
┌───────────────────────────────────────────────┐
│ Codex · Claude Code · Cursor · any MCP client │
└──────────────────────┬────────────────────────┘
                       │ local stdio
                       ▼
                ┌─────────────┐
                │  Sosis MCP  │  ← primary interface
                └──────┬──────┘
                       │
             ┌─────────▼─────────┐
             │ shared safe core  │◀──── optional web dashboard
             └─────────┬─────────┘
                       │ signed HTTPS requests
                       ▼
              App Store Connect API
```

MCP calls App Store Connect directly through the shared core. The Next.js server does **not** need to be running while an agent uses MCP.

## Quick start

### Requirements

- macOS
- Node.js 20 or newer
- An App Store Connect API key with permissions appropriate for the actions you want to perform

### Ask your agent to add Sosis MCP

The easiest setup is to open the cloned Sosis repository in Codex, Claude Code, or Cursor and paste this message:

```text
Set up Sosis as a local MCP server for the agent client I am currently using.

You are already inside the Sosis repository. Inspect package.json and
docs/agent-integrations.md before acting, resolve the repository's absolute
path, and use the supported local stdio configuration for this agent client.
The server command must be:

  npm --prefix <absolute-sosis-path> run mcp

If a Sosis MCP entry already exists, verify or repair it instead of creating a
duplicate. Install npm dependencies only if they are missing. Run
`npm run mcp:doctor`, verify that the MCP entry is enabled, then start a real
stdio MCP client and test `list_accounts` and `list_apps` as read-only calls.

Do not create a remote MCP server. Do not expose or print .p8 contents,
Keychain values, JWTs, or other secrets. Do not change App Store Connect data.
Request any system/configuration approval required by the client. When finished,
tell me exactly what was configured, what checks passed, and whether I need to
restart the client or open a new task before Sosis tools appear.
```

That prompt authorizes the agent to configure the local MCP connection, but not to make App Store Connect changes. Most clients need a restart or a new task before a newly added MCP server appears in the tool list.

### 1. Install

```bash
git clone <your-repository-url> sosis
cd sosis
npm install
```

### 2. Add an App Store Connect account

Start the local visual dashboard:

```bash
npm run dev
```

Open [http://localhost:3000/accounts](http://localhost:3000/accounts) and enter:

- a local account label;
- Issuer ID;
- Key ID;
- the contents of the `.p8` private key.

The `.p8` value is encrypted immediately and never returned to the browser or an MCP client.

### 3. Verify the local installation

```bash
npm run mcp:doctor
```

The doctor checks Node.js, macOS Keychain access, encrypted credentials, local file permissions, the MCP SDK, and the bundled ASO skill index. It does not contact App Store Connect.

### 4. Connect your agent

#### Codex

```bash
codex mcp add sosis -- npm --prefix "/absolute/path/to/sosis" run mcp
codex mcp get sosis
```

Start a new Codex task or restart the desktop client after adding the server. Codex starts the stdio process automatically when it needs Sosis; there is no MCP daemon to keep running manually.

#### Claude Code

```bash
claude mcp add --transport stdio --scope user sosis -- \
  npm --prefix "/absolute/path/to/sosis" run mcp
claude mcp get sosis
```

#### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sosis": {
      "command": "npm",
      "args": ["--prefix", "/absolute/path/to/sosis", "run", "mcp"]
    }
  }
}
```

See [Agent integrations](docs/agent-integrations.md) for client-specific scopes, approval settings, troubleshooting, and recommended prompts.

## Try it

Start with a read-only inventory:

```text
Use Sosis to list my App Store Connect accounts, apps, current versions,
and available localizations. Do not make any changes.
```

Create a localization plan:

```text
Use Sosis to read the localization context for version <version-id>.
Draft every missing locale using your own model, validate all field limits,
and create one batch plan. Show me the complete diff and stop before apply.
```

Recover an accidental edit:

```text
Use Sosis to list recent snapshots and deletion backups for this app.
Explain what each restore would overwrite and stop before writing.
```

## Bundled ASO skills

Sosis includes a pinned copy of the MIT-licensed [Eronred/aso-skills](https://github.com/Eronred/aso-skills) library. The MCP exposes three read-only discovery tools:

- `list_aso_skills` — browse all bundled specialists;
- `search_aso_skills` — route a natural-language request to the best skill;
- `get_aso_skill` — load the selected methodology with Sosis safety rules.

Example:

```text
Use Sosis to find the right ASO skill for keyword research on my app.
Read my current metadata from Sosis, use any available Astro, Appfigures,
Appeeky, or other ASO data MCP for live volume/difficulty/ranking evidence,
then return a prioritized keyword report. Do not invent missing metrics and
stop before making App Store Connect changes.
```

Cross-MCP orchestration happens in the host agent:

```text
Sosis ASO skill ────── methodology and output format
Sosis ASC tools ────── current first-party app metadata and protected writes
External ASO MCP ───── live keyword, ranking, competitor, and chart evidence
Host agent model ───── analysis, synthesis, and copy generation
```

Sosis does not proxy or silently call another MCP server. The agent can combine tools from every MCP visible in the same session. If no live-data provider is connected, it must identify missing evidence instead of fabricating volume, difficulty, rank, or download estimates.

Provider-specific signup, API-key, curl, or ASC-sync directions inside the upstream skills are overridden by Sosis integration rules. ASC credentials remain local unless the user separately and explicitly chooses another service.

## Agent-owned localization

Sosis deliberately separates language generation from App Store writes:

1. `get_localization_context` returns current values, locales, and field rules.
2. The host agent drafts the copy using its own model.
3. `validate_localization_payload` checks supported fields and limits.
4. `plan_localization_batch` creates a complete before/after diff.
5. The user reviews the entire batch.
6. `apply_localization_batch` snapshots, writes, and verifies each locale.

Nothing is written during the context, validation, or planning steps.

To recover exact metadata that still exists in App Store Connect, use `plan_copy_localizations_from_version` instead of asking the model to recreate it.

## Screenshot workflow

Sosis supports agent-created or manually captured screenshots without needing an embedded image model:

1. `get_screenshot_context` returns locales, display types, existing sets, and expected directory layouts.
2. The agent or user creates image files locally.
3. `plan_screenshot_upload` validates every folder and file without uploading.
4. The user reviews mappings, ordering, skipped folders, and warnings.
5. `upload_screenshots_from_directory` performs the confirmed upload.

Default directory layout:

```text
screenshots/
  APP_IPHONE_67/
    en-US/
      01-home.png
      02-editor.png
    tr-TR/
      01-home.png
      02-editor.png
```

Replacing existing screenshots requires both `confirmed: true` and the exact phrase:

```text
REPLACE SCREENSHOTS <versionId>
```

Before deleting the first asset, Sosis downloads and checksums **every** affected screenshot. Each backup can later be restored with its previous order.

## Safety and recovery

| Operation | Protection | Recovery |
|---|---|---|
| Version/App Info/subscription/TestFlight text | Plan, stale-state check, snapshot, post-write verification | Restore snapshot |
| App Review details | Same protected flow; demo password encrypted and redacted | Restore existing record |
| First App Review detail creation | Full validation and encrypted plan | Not automatically reversible; Apple has no delete operation |
| Screenshot deletion/replacement | Download, Apple-host allowlist, image validation, size limit, SHA-256 checksum | Restore bytes and previous order |
| Version/subscription localization deletion | Record metadata before delete | Recreate and verify localization |
| App Preview deletion | Blocked | No false recovery promise |
| Full subscription deletion | Hidden from web; exact resource-bound MCP confirmation | Irreversible |

Additional rules:

- Every MCP write requires `confirmed: true` after the agent shows the exact account, targets, effect, and recovery path.
- High-impact actions require a fresh phrase such as `RELEASE <versionId>`, `SUBMIT <versionId>`, or `DELETE SCREENSHOT <screenshotId>`.
- Plans expire after 24 hours.
- A plan is rejected if App Store Connect changed after planning.
- Restore refuses to overwrite newer remote values unless the conflict is explicitly reviewed and forced.
- A restore creates another safety snapshot whenever the remote resource supports it.
- Reviews and other ASC strings are treated as untrusted data, never as agent instructions.

## Local security model

Sosis is intentionally designed for one local macOS user.

- The MCP server uses stdio and does not expose a hosted MCP endpoint.
- The optional web server binds to `127.0.0.1` and rejects non-local Host, cross-site, and mismatched Origin requests.
- ASC `.p8` keys are AES-256-GCM encrypted under `~/.sosis/credentials/`.
- The random 32-byte encryption master key lives in macOS login Keychain under `com.sosis.master-key.v1`.
- `accounts.json` contains public account metadata only.
- App Review demo credentials are redacted from normal plans, snapshots, errors, logs, and MCP output.
- JWTs are short-lived and cached against the credential version.

This protects credentials at rest and avoids a remote Sosis breach surface. It does not protect against malware or a compromised agent running as the same macOS user. Use FileVault, a strong macOS login password, trusted agent clients, and least-privilege ASC keys.

## Local data

```text
~/.sosis/
  accounts.json             # public ASC account metadata
  credentials/              # encrypted .p8 envelopes
  config.json
  changes/
    plans/                  # 24-hour change plans
    snapshots/              # before/after audit and restore records
    secure/                 # encrypted App Review payloads
  backups/
    records/                # deletion manifests
    assets/                 # checksummed screenshot bytes
  logs/

macOS login Keychain
  com.sosis.master-key.v1   # local encryption master key
```

Back up `~/.sosis/` using an encrypted machine backup. Copying only the encrypted credential files to another Mac is intentionally insufficient without the matching Keychain master key.

## Optional visual dashboard

Development mode:

```bash
npm run dev
```

Persistent local installation:

```bash
npm run setup
```

`npm run setup` creates a local `launchd` service and opens the dashboard at `http://127.0.0.1:3737`. The dashboard is useful for:

- initial account setup;
- browsing App Store state visually;
- reviewing protected change history;
- restoring snapshots and deletion backups.

The MCP server remains independent from this service.

## MCP tool groups

The tool surface is organized around workflows rather than raw API endpoints:

- **Discovery:** accounts, apps, versions, builds, localizations, reviews.
- **ASO intelligence:** skill routing and methodologies for keyword, metadata, competitors, creative, reviews, growth, and market analysis.
- **Localization:** context, validation, single/batch plans, older-version copy, apply, restore.
- **Protected text:** App Info, subscriptions, TestFlight, App Review.
- **Release:** version creation, build attachment, readiness, submission, release, phased release.
- **TestFlight:** builds, compliance, beta groups, testers, group membership.
- **Subscriptions:** groups, products, localizations, offers, pricing.
- **Media:** screenshot context/planning/upload/order/backup and App Preview upload.
- **Recovery:** change snapshots, deletion backups, verified restore.

Run the server manually only for protocol debugging:

```bash
npm run mcp
```

Normally the MCP client starts and stops this command itself.

## Development

```bash
npm run dev          # optional Next.js dashboard
npm run mcp          # stdio MCP server
npm run mcp:doctor   # local installation diagnostics
npm test             # Node test suite
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript check
npm run build        # production dashboard build
```

Before opening a pull request:

```bash
npm test && npm run lint && npx tsc --noEmit && npm run build
```

Tests cover protected plans, stale conflicts, ambiguous accepted writes, batch localization, encrypted credentials, Keychain command safety, secret redaction, screenshot checksums/order, deletion backups, and idempotent recovery.

## Known boundaries

- macOS is currently required because credential encryption depends on login Keychain.
- Sosis is local single-user software, not a remotely hosted multi-tenant service.
- App Preview deletion remains blocked until Sosis can make a faithful video backup.
- Apple does not provide a delete operation for the first App Review detail record, so that creation cannot be automatically undone.
- Full subscription deletion is intentionally treated as irreversible.

## Documentation

- [Agent integration guide](docs/agent-integrations.md)
- [Security policy](SECURITY.md)
- [OpenAI Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [Cursor MCP documentation](https://cursor.com/docs/context/mcp)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [Vendored ASO skill source](https://github.com/Eronred/aso-skills) — pinned commit and MIT notice under `vendor/aso-skills/`

## License

MIT
