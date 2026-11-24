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
- Allure and HTML reporters configured for test runs
- Automatic GitHub Pages publishing of Allure reports from `main` once test results exist
- Test target can be overridden with `APP_BASE_URL` and `API_BASE_URL`

The team-shared endpoint tables are documented in [docs/API_REFERENCE.md](docs/API_REFERENCE.md). The routes were checked against the configured practice host; confirm the host again if you point the suite at a different environment.

## Project structure

```text
.github/workflows/  CI validation and report publishing
docs/               API reference and team plan
tests/api/          API contract tests
tests/fixtures/     Shared Playwright API fixture
tests/web/          Browser end-to-end tests
```

`node_modules/` is installed locally by `npm ci` and is ignored by Git. Playwright and Allure report folders are generated when tests run and are also ignored; they are outputs, not source folders.

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

`npm run test:web` runs the web suite in Chromium, Firefox, and WebKit; use `npm run test:web:chromium` for a quicker single-browser run. API tests create and clean up a uniquely named user. Tests that create simulated orders are skipped by default; enable them locally with `RUN_MUTATING_TESTS=true` or select the option when manually starting the GitHub Actions workflow. The optional `/api/reset` test is skipped unless `RUN_RESET_API_TEST=true` is set.

In PowerShell, opt into simulated-order tests with:

```powershell
$env:RUN_MUTATING_TESTS = "true"
npm.cmd test
Remove-Item Env:RUN_MUTATING_TESTS
```

Set `APP_BASE_URL` or `API_BASE_URL` in the shell or local `.env` to select a different target. Playwright loads a local `.env` when present. Never commit real credentials or environment files. Checkout tests use only the demo shop's published test cards; they must never use real payment details.

On Windows PowerShell, if script execution blocks `npm.ps1`, run commands with `npm.cmd` (for example, `npm.cmd test`).

Allure results are written to `allure-results/`; generate and open a report with `npm run allure:generate` and `npm run allure:open` (Java 17 or newer is required). After tests run on `main`, Actions deploys the report to GitHub Pages. This publishes reports, not the external practice shop.

## Team workflow

See [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md) for the short-task backlog, meeting and demo cadence, and review expectations. The repository is public; add teammates through GitHub repository settings when their usernames are available.
