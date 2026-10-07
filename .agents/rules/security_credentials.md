# Security & Credential Rules (Strict)

1. **NEVER open, view, or read `.env*` files containing secrets:**
   - The agent is strictly forbidden from using `view_file`, `cat`, `Get-Content`, or any read tool on `.env`, `.env.local`, `.env.production`, etc.
   - When key names or schema shapes are needed, only inspect `.env.example`.
   - Never print, echo, log, or include secret keys, JWTs (starting with `eyJ`), or tokens in terminal command strings or scripts.

2. **Credential Stores & Tokens:**
   - NEVER query credential stores (`git credential fill`, Windows Credential Manager, Keychain).
   - If commands require environment variables, consume them natively via `process.env` or `node --env-file=.env.local` without printing or embedding values.
   - The agent must NEVER run requests against live production databases using service-role keys. Live project management queries must be run by the user.

3. **Tripwire Rule:**
   - If any string matching `gho_` (GitHub token) or `eyJ` (JWT token) ever appears in output or commands, it is treated as an immediate credential burn requiring instant rotation.

4. **GitHub CLI & Actions:**
   - Never pass OAuth tokens or PATs to `gh` or git commands.
   - Never run automated rapid-polling loops.
