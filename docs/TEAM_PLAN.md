# Team plan

## Working agreements

- Keep each proposed task to one working day or less. Split larger work into independent, reviewable issues.
- At the morning meeting, each contributor presents their proposed task and receives team remarks before work starts.
- The unofficial facilitator is `filned01`. The preferred morning meeting time and the manager's invitation details are not set yet.
- The manager is an observer during discussion and may give remarks only at the end.
- Every pull request needs a review from a different contributor. Rotate reviewer pairings daily; authors do not approve their own changes.
- Keep coverage focused on user-visible behavior and documented API contracts. Do not invent endpoints or use real personal/payment data.
- The initial team roster contains only the repository owner. Add team members before assigning reciprocal reviews or sending invitations.

## Initial backlog (each item is scoped to at most one day)

1. Explore the shop and document user journeys, test data, and stability risks.
2. Confirm whether the shop exposes a supported API; record its base URL, authentication needs, and endpoint contracts.
3. Agree the test folder structure, page-object boundaries, fixture ownership, and naming conventions.
4. Cover the product catalog, categories, sorting, search, and pagination in small, independently reviewable tasks.
5. Cover product details, variants, stock states, and cart behavior in separate tasks.
6. Cover checkout validation and demo account/inbox journeys only after confirming safe test data and expected behavior.
7. Add API scenarios per confirmed resource/endpoint group, each with independent data setup and cleanup.
8. Add browser coverage, accessibility checks, and reliability improvements in separately scoped tasks.
9. Complete Allure history/report publishing and review the CI workflow with the team.
10. Review requirement traceability, report gaps against the automation target, and prepare each demo.

The list is a starting point for the team to refine in the morning meeting; each numbered item should be split further if it exceeds one day.

## Meetings and demos

- Daily morning planning meeting: cadence requested; time, timezone, and calendar invitees are still to be confirmed.
- First demo: Friday, 27 November 2026.
- Second demo: Friday, 4 December 2026.
- Target deadline: next week; confirm the exact date at kickoff and extend if the group agrees the scope is too short.

## Review rotation

Once teammates join, publish a daily author-to-reviewer pairing in the meeting notes. Choose a reviewer who did not author the pull request and rotate assignments so everyone reviews someone else's work. Until then, this cannot be exercised by the single-person roster.

## Deployment

The shop is an external practice application, not an app maintained in this repository. CI can run automation and publish Allure reports to GitHub Pages; deploying the shop itself requires a separate application and hosting target.
