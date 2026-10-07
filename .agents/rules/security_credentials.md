# Security & Credential Rules

1. **NEVER read system credential stores or extract tokens:**
   - Never run `git credential fill`, query Windows Credential Manager, Keychain, or any secret store.
   - Never paste tokens, secrets, or API keys directly into terminal command strings, scripts, or commit history.

2. **GitHub CLI & Authentication:**
   - If GitHub operations are required via `gh`, the user must authenticate themselves interactively using `gh auth login` via the browser flow.
   - The agent must only run unauthenticated or natively session-authenticated commands without passing tokens.

3. **No Polling Loops:**
   - Never poll GitHub Actions or external services in rapid command loops. Check status once when requested or rely on asynchronous webhooks/eventual user inspection.

4. **Database Safety:**
   - Local database tests and replay scripts must only ever target throwaway local databases (`ci_scratch`) on `localhost`.
   - Never point `DATABASE_URL` at production or hosted Supabase instances during automated test execution.
