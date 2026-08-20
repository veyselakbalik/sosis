# Contributing

Sosis is a local stdio MCP server. There is no web UI in this repository.

## Checks

```bash
npm test && npm run lint && npx tsc --noEmit
```

## Adding an MCP tool

1. Define the tool in `mcp/server.ts` and implement it against `src/lib/` or `mcp/sosis-client.ts`.
2. Keep generation (copy, translations, replies) in the host agent. Sosis validates, plans, diffs, writes, and verifies.
3. If the tool writes to App Store Connect, add its name to `EXTERNAL_WRITE_TOOLS` in `src/lib/core/mcp-tool-safety.ts`.
4. If it is destructive or high-impact, add it to the matching safety set and an exact confirmation phrase bound to a resource id.
5. Cover the safety path with a test in `src/lib/core/mcp-tool-safety.test.ts` or the relevant change/backup test file.
6. Never return `.p8` contents, JWTs, Keychain values, or App Review demo passwords.

## Account credentials

Add keys with the CLI so the private key is read from a local file:

```bash
npm run sosis -- accounts add --label NAME --issuer-id UUID --key-id KEY --p8 ./AuthKey.p8
```

`add_account` may take a filesystem path for the same reason. Do not add a tool argument that accepts raw PEM.

## Scope

Useful contributions: safer ASC writes, restore/backup coverage, CLI polish, tests, and docs.

Please do not reintroduce a hosted HTTP API, a bundled LLM provider, or a master-password vault.
