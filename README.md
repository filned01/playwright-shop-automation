# Playwright Shop Automation

Playwright framework foundation for the [QA Electronics practice shop](https://playwright-playground.com/shop).
The target is a public demo environment; do not enter real payment details, passwords, or addresses.

## Status

This repository contains the initial Playwright test suite for the practice shop and documented practice APIs.

- Playwright Test with separate browser and API projects
- TypeScript configuration and a reusable Playwright API request fixture
- API coverage for the Shop API, Users API, and authentication/utility endpoints
- Web coverage for catalog browsing, search, cart, sign-in, and checkout flows
- GitHub Actions validation on pushes and pull requests
- Playwright HTML reports available locally and as GitHub Actions artifacts
- Test target can be overridden with `APP_BASE_URL` and `API_BASE_URL`

The team-shared endpoint tables are documented in [docs/API_REFERENCE.md](docs/API_REFERENCE.md). The routes were checked against the configured practice host; confirm the host again if you point the suite at a different environment.

## Project structure

```text
.github/workflows/  CI validation and report artifacts
docs/               API reference and team plan
tests/api/          API contract tests
tests/fixtures/     Shared Playwright API fixture
tests/web/          Browser end-to-end tests
```

`node_modules/` is installed locally by `npm ci` and is ignored by Git. Playwright test results and HTML reports are generated when tests run and are also ignored; they are outputs, not source folders.

## Getting started

```powershell
npm ci
npx playwright install
Copy-Item .env.example .env
npm run typecheck
```

Run the test suite with:

```powershell
npm test
npm run test:web
npm run test:api
npm run lint
npm run format:check
```

`npm run test:web` runs the web suite in Chromium, Firefox, and WebKit; use `npm run test:web:chromium` for a quicker single-browser run. API tests create and clean up a uniquely named user. Order-creating tests, including the API-to-UI order-history check, are skipped by default; enable them locally with `RUN_MUTATING_TESTS=true` or select the option when manually starting the GitHub Actions workflow. The Orders API lifecycle test also registers a uniquely named Shop account to verify order ownership; that account and its data persist until the demo resets after an hour without activity. Most opt-in order tests cancel their orders; one waits for shipment to verify that shipped orders cannot be cancelled and leaves that simulated order in the demo. Demo data is private per visitor. The optional `/api/reset` test is skipped unless `RUN_RESET_API_TEST=true` is set.

In PowerShell, opt into simulated-order tests with:

```powershell
$env:RUN_MUTATING_TESTS = "true"
npm.cmd test
Remove-Item Env:RUN_MUTATING_TESTS
```

Set `APP_BASE_URL` or `API_BASE_URL` in the shell or local `.env` to select a different target. Playwright loads a local `.env` when present. Never commit real credentials or environment files. Checkout tests use only the demo shop's published test cards; they must never use real payment details.

On Windows, `tools/install-daily-git-sync.ps1` installs a local Task Scheduler job that runs daily at 4:00 PM computer time. It runs lint, typecheck, and the routine Playwright suite before staging all repository changes, committing, and pushing to the current tracked `origin` branch. It skips when there are no changes, and stops on failed checks, branch divergence, or sensitive-looking filenames. The job runs under your interactive account, so you need to be signed in; if the laptop sleeps through the scheduled time, it starts when available after wake. Logs are written under `%LOCALAPPDATA%\PlaywrightShopDailyCommit\logs`. Remove the task with `Unregister-ScheduledTask -TaskName PlaywrightShopDailyCommit`.

On Windows PowerShell, if script execution blocks `npm.ps1`, run commands with `npm.cmd` (for example, `npm.cmd test`). Open the latest local HTML report with `npx playwright show-report`.

## Team workflow

See [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md) for the short-task backlog, meeting and demo cadence, and review expectations. The repository is public; add teammates through GitHub repository settings when their usernames are available.
