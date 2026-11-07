# Seldon QA for OneLine

Our two core workflows ("Create an invoice from one sentence" and "Client pays the invoice") are written
in plain English in [`seldon.yml`](../seldon.yml). Seldon's AI agent opens the live site and runs them
like a real user. There are three ways to run them: pick whichever fits your computer.

| Where | Works on | Needs |
|---|---|---|
| **A. GitHub Actions** (automatic) | any computer, nothing to install | `SELDON_API_KEY` repo secret |
| **B. Your terminal** (`npm run qa`) | Mac, Linux, or Windows **inside WSL** | Node 20+, a Seldon API key |
| **C. Seldon dashboard** | any browser | access to the Seldon workspace the run belongs to |

> The Seldon CLI has no native Windows build. On Windows, use **A** or run **B** inside WSL (below).

**Before any run:** open `https://tackle-sub-2ji7.vercel.app/settings` and click
**Delete all invoices & clients**, so the dashboard checks start from a clean slate.

---

## Get an API key (once)

Seldon → **Settings → Developer** → create an API key. It starts with `seldon_`.
Never commit it or paste it in chat. It goes in a GitHub secret or your own terminal only.

## A. GitHub Actions (recommended for the final build)

1. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**.
   Name: `SELDON_API_KEY`. Value: your key.
2. Every production deploy of `main` now runs the tests automatically. To run them by hand:
   **Actions → Publish GitHub Deployment → Run workflow → Run**.
3. Open the run, then the **seldon-qa** job: the **Summary** page has the full PASS/FAIL report
   (screenshot this). The run also appears in Seldon → **Experiments**.

## B. Your terminal

### Mac / Linux

```bash
cd tackle-sub
npm run seldon -- login seldon_YOUR_KEY   # saves the key once (or: export SELDON_API_KEY=seldon_...)
npm run qa:validate                       # checks seldon.yml with Seldon's own rules
npm run qa                                # runs both tests on the live site and waits for the verdict
npm run qa:report                         # prints the full report (--md, ready to paste)
```

Also useful: `npm run qa:logs` (watch the agent think, live) and `npm run qa:runs` (list your runs).
Any other Seldon command works as `npm run seldon -- <command>`, for example `npm run seldon -- cancel --id exp_...`.

### Windows (WSL)

1. Open **PowerShell as Administrator** and run `wsl --install`, then restart.
2. Open **Ubuntu** from the Start menu. First time only:
   ```bash
   sudo apt update && sudo apt install -y git curl
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   git clone https://github.com/AnudeepGumpula/tackle-sub.git && cd tackle-sub
   ```
3. Then the same commands as Mac / Linux above (`npm run seldon -- login ...`, `npm run qa`, ...).
   You don't need `npm install` for these: they fetch the pinned CLI on demand.

## C. See a teammate's run

Runs belong to the Seldon workspace of the API key that started them. To see a run someone else
started (for example on a Mac), log in at **app.seldon.com → Experiments** with an account in the
**same workspace**: ask them to invite you. Or ask for the run id (`exp_...`) and run
`npm run seldon -- report --id exp_... --md --full` with a key from that workspace.

---

## Editing the tests

- Edit `seldon.yml` and commit it with the UI change it covers. The file is the whole test plan:
  Seldon keeps no server-side copy.
- **Keep every step in quotes.** An unquoted step containing `: ` (colon + space) becomes a key/value
  pair and Seldon rejects the file.
- If you rename a button or change on-screen text that a step mentions, update the step too.
- Check with `npm run qa:validate` before running.

## If something goes wrong

| Seldon says | Usually means | Fix |
|---|---|---|
| `isn't valid at testCases[...]` | YAML or schema problem | quote the step / fix the field it names |
| **BLOCKED** | the agent couldn't reach or use the page | turn off Vercel Authentication (Deployment Protection) for the project |
| **FAIL** on the payment test | test-mode Pay button missing | set `ENABLE_TEST_PAYMENTS=true` in Vercel (Production and Preview) |
| `case_limit_exceeded` / `concurrency_limit_exceeded` | plan limits | wait for the running run, or `npm run seldon -- cancel --all` |
| `error: unknown command 'api'` | CLI can't reach Seldon with your key | `npm run seldon -- config show`, check the key |
