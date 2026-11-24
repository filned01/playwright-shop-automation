# Playwright Shop Automation

Playwright framework foundation for the [QA Electronics practice shop](https://playwright-playground.com/shop).
The target is a public demo environment; do not enter real payment details, passwords, or addresses.

## Status

This repository is set up for the team task. No test cases have been added yet.

- Playwright Test with separate browser and API projects
- TypeScript configuration and a reusable Playwright API request fixture
- GitHub Actions validation on pushes and pull requests
- Allure and HTML reporters configured for future test runs
- Automatic GitHub Pages publishing of Allure reports from `main` once test results exist
- Test target can be overridden with `APP_BASE_URL` and `API_BASE_URL`

The site provided so far is a browser application. Its API surface still needs to be identified and agreed before API scenarios are written. The API project and fixture are ready, but do not assume undocumented endpoints.

## Getting started

```powershell
npm ci
npx playwright install
Copy-Item .env.example .env
npm run typecheck
```

When test cases are added, run them with:

```powershell
npm test
npm run test:web
npm run test:api
```

Set `APP_BASE_URL` or `API_BASE_URL` in the shell or local `.env` to select a different target. Never commit real credentials or environment files.

Allure results are written to `allure-results/`; generate and open a report with `npm run allure:generate` and `npm run allure:open` (Java 17 or newer is required). After tests run on `main`, Actions deploys the report to GitHub Pages. This publishes reports, not the external practice shop.

## Team workflow

See [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md) for the short-task backlog, meeting and demo cadence, and review expectations. The repository is public; add teammates through GitHub repository settings when their usernames are available.
