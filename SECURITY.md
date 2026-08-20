# Security

Sosis stores App Store Connect API keys on the local Mac. Treat this repository as public from the first commit.

## Do not publish

Never include any of the following in issues, pull requests, logs, or screenshots:

- `.p8` private keys or other PEM material
- JWTs
- Keychain master keys
- App Review demo passwords
- contents of `~/.sosis/` or `~/.easyapp/`
- `.env*` files

`.p8` files, `.env*`, and local data directories are gitignored. If you accidentally commit a secret, rotate the App Store Connect key immediately. Rewriting git history is not enough once a public clone exists.

## Threat model

Sosis is local single-user software:

- The MCP server uses stdio. It is not a hosted MCP endpoint.
- The optional dashboard is intended to bind to `127.0.0.1`.
- `.p8` contents are encrypted at rest under `~/.sosis/credentials/`.
- The encryption master key lives in the macOS login Keychain.

This protects credentials at rest and avoids a remote Sosis service as a breach surface. It does **not** protect against malware or a compromised process already running as the same macOS user.

## Reporting a vulnerability

Use a [GitHub security advisory](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/about-repository-security-advisories) for credential handling, write-confirmation bypasses, restore/backup integrity, or localhost-binding issues.

Do not file a public issue for those classes of bug.
