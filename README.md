# Sosis

> A local-first, agent-native control layer for App Store Connect.

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![macOS](https://img.shields.io/badge/macOS-Keychain-000000?logo=apple&logoColor=white)](https://support.apple.com/guide/keychain-access/welcome/mac)
[![MCP](https://img.shields.io/badge/MCP-stdio-5A45FF)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

Sosis lets Codex, Claude Code, Cursor, and other MCP-compatible agents inspect and manage App Store Connect through typed local tools.

There is no web app and no hosted Sosis service. The product is a local stdio MCP server plus a small CLI for adding API keys.

**No Sosis AI API key. No `.p8` contents in chat, logs, or tool results.**

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

## Architecture

```text
┌───────────────────────────────────────────────┐
│ Codex · Claude Code · Cursor · any MCP client │
└──────────────────────┬────────────────────────┘
                       │ local stdio
                       ▼
                ┌─────────────┐
                │  Sosis MCP  │
                └──────┬──────┘
                       │
             ┌─────────▼─────────┐
             │ shared safe core  │◀──── CLI (account add/remove)
             └─────────┬─────────┘
                       │ signed HTTPS requests
                       ▼
              App Store Connect API
```

## Quick start

### Requirements

- macOS
- Node.js 20 or newer
- An App Store Connect API key with permissions appropriate for the actions you want to perform

### 1. Install

```bash
git clone https://github.com/veyselakbalik/sosis.git sosis
cd sosis
npm install
```

### 2. Add an App Store Connect account

```bash
npm run sosis -- accounts add \
  --label "Main" \
  --issuer-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --key-id "ABCDE12345" \
  --p8 ./AuthKey_ABCDE12345.p8
```

Sosis reads the `.p8` file from disk, encrypts it, and stores only public metadata in `~/.sosis/accounts.json`. It never prints the private key. Do not paste `.p8` contents into an agent chat.

List or remove local accounts the same way:

```bash
npm run sosis -- accounts list
npm run sosis -- accounts remove --id <account-id> --yes
```

### 3. Verify the local installation

```bash
npm run mcp:doctor
```

The doctor checks Node.js, macOS Keychain access, encrypted credentials, local file permissions, the MCP SDK, and the bundled ASO skill index. It does not contact App Store Connect.

### 4. Connect your agent

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

Do not create a remote MCP server. Do not read, expose, or print .p8 contents,
Keychain values, JWTs, or other secrets. Do not change App Store Connect data.
If no local account exists, tell me the exact `npm run sosis -- accounts add`
command to run; do not add the key yourself. Request any system/configuration
approval required by the client. When finished, tell me exactly what was
configured, what checks passed, and whether I need to restart the client or
open a new task before Sosis tools appear.
```

That prompt authorizes the agent to configure the local MCP connection, but not to make App Store Connect changes or ingest a private key.

#### Codex

```bash
codex mcp add sosis -- npm --prefix "/absolute/path/to/sosis" run mcp
codex mcp get sosis
```

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

Cross-MCP orchestration happens in the host agent:

```text
Sosis ASO skill ────── methodology and output format
Sosis ASC tools ────── current first-party app metadata and protected writes
External ASO MCP ───── live keyword, ranking, competitor, and chart evidence
Host agent model ───── analysis, synthesis, and copy generation
```

Sosis does not proxy or silently call another MCP server. If no live-data provider is connected, the agent must identify missing evidence instead of fabricating volume, difficulty, rank, or download estimates.

## Agent-owned localization

1. `get_localization_context` returns current values, locales, and field rules.
2. The host agent drafts the copy using its own model.
3. `validate_localization_payload` checks supported fields and limits.
4. `plan_localization_batch` creates a complete before/after diff.
5. The user reviews the entire batch.
6. `apply_localization_batch` snapshots, writes, and verifies each locale.

To recover exact metadata that still exists in App Store Connect, use `plan_copy_localizations_from_version` instead of asking the model to recreate it.

## Screenshot workflow

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

Replacing existing screenshots requires both `confirmed: true` and the exact phrase `REPLACE SCREENSHOTS <versionId>`. Before deleting the first asset, Sosis downloads and checksums **every** affected screenshot.

## Safety and recovery

| Operation | Protection | Recovery |
|---|---|---|
| Version/App Info/subscription/TestFlight text | Plan, stale-state check, snapshot, post-write verification | Restore snapshot |
| App Review details | Same protected flow; demo password encrypted and redacted | Restore existing record |
| First App Review detail creation | Full validation and encrypted plan | Not automatically reversible; Apple has no delete operation |
| Screenshot deletion/replacement | Download, Apple-host allowlist, image validation, size limit, SHA-256 checksum | Restore bytes and previous order |
| Version/subscription localization deletion | Record metadata before delete | Recreate and verify localization |
| App Preview deletion | Blocked | No false recovery promise |
| Full subscription deletion | Exact resource-bound MCP confirmation | Irreversible |
| Local account removal | CLI `--yes` or `REMOVE ACCOUNT <accountId>` | Re-add the `.p8` |

Additional rules:

- Every MCP write requires `confirmed: true` after the agent shows the exact account, targets, effect, and recovery path.
- High-impact actions require a fresh phrase such as `RELEASE <versionId>`, `SUBMIT <versionId>`, or `DELETE SCREENSHOT <screenshotId>`.
- Plans expire after 24 hours.
- A plan is rejected if App Store Connect changed after planning.
- Restore refuses to overwrite newer remote values unless the conflict is explicitly reviewed and forced.
- Reviews and other ASC strings are treated as untrusted data, never as agent instructions.

## Local security model

Sosis is intentionally designed for one local macOS user.

- The MCP server uses stdio and does not expose a hosted MCP or HTTP endpoint.
- Add API keys with the CLI so the private key is read from a local file, not from chat.
- ASC `.p8` keys are AES-256-GCM encrypted under `~/.sosis/credentials/`.
- The random 32-byte encryption master key lives in macOS login Keychain under `com.sosis.master-key.v1`.
- `accounts.json` contains public account metadata only.
- App Review demo credentials are redacted from normal plans, snapshots, errors, logs, and MCP output.
- JWTs are short-lived and cached against the credential version.

This protects credentials at rest and avoids a remote Sosis breach surface. It does not protect against malware or a compromised agent running as the same macOS user.

## Local data

```text
~/.sosis/
  accounts.json             # public ASC account metadata
  credentials/              # encrypted .p8 envelopes
  config.json               # leftover from older dashboard installs; unused
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

If you previously installed the optional dashboard as a login service, remove it with `npm run uninstall`. That command does not delete `~/.sosis/`.

## MCP tool groups

- **Accounts:** list, add from a `.p8` path, remove.
- **Discovery:** apps, versions, builds, localizations, reviews.
- **ASO intelligence:** skill routing and methodologies.
- **Localization:** context, validation, single/batch plans, older-version copy, apply, restore.
- **Protected text:** App Info, subscriptions, TestFlight, App Review.
- **Release:** version creation, build attachment, readiness, submission, release, phased release.
- **TestFlight:** builds, compliance, beta groups, testers, group membership.
- **Subscriptions:** groups, products, localizations, offers, pricing.
- **Media:** screenshot context/planning/upload/order/backup and App Preview upload.
- **Recovery:** change snapshots, deletion backups, verified restore.

Normally the MCP client starts and stops `npm run mcp` itself.

## Development

```bash
npm run sosis -- help   # local CLI
npm run mcp             # stdio MCP server
npm run mcp:doctor      # local installation diagnostics
npm test                # Node test suite
npm run lint            # ESLint
npx tsc --noEmit        # TypeScript check
```

Before opening a pull request:

```bash
npm test && npm run lint && npx tsc --noEmit
```

See [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).

## Known boundaries

- macOS is currently required because credential encryption depends on login Keychain.
- Sosis is local single-user software, not a remotely hosted multi-tenant service.
- App Preview deletion remains blocked until Sosis can make a faithful video backup.
- Apple does not provide a delete operation for the first App Review detail record, so that creation cannot be automatically undone.
- Full subscription deletion is intentionally treated as irreversible.

## Documentation

- [Agent integration guide](docs/agent-integrations.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [OpenAI Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [Cursor MCP documentation](https://cursor.com/docs/context/mcp)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [Vendored ASO skill source](https://github.com/Eronred/aso-skills) — pinned commit and MIT notice under `vendor/aso-skills/`

## License

MIT
