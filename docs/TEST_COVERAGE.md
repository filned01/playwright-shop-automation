# Test coverage map

This map links major practice requirements to the existing Playwright coverage.
Mutating tests are opt-in and must use the documented demo data only.

| Area | Requirement | Main coverage |
| --- | --- | --- |
| Catalog | Search, category, sort, pagination, details | `tests/web/search.web.spec.ts`, `tests/web/products.web.spec.ts`, `tests/api/shop.api.spec.ts` |
| Cart | Options, quantity, stock, delivery, isolation | `tests/web/cart.web.spec.ts`, `tests/web/isolation.web.spec.ts`, `tests/api/shop.api.spec.ts` |
| Promos | SAVE10, WELCOME20, FREESHIP, SUMMER25, unknown codes | `tests/web/cart.web.spec.ts`, `tests/api/shop.api.spec.ts` |
| Accounts | Sign-in, sign-out, locked account, registration | `tests/web/account.web.spec.ts`, `tests/api/shop.api.spec.ts` |
| Authentication | Demo login, bearer token, `/api/me` | `tests/api/auth.api.spec.ts` |
| Users | List, filter, CRUD, validation | `tests/api/users.api.spec.ts`, `tests/web/network.web.spec.ts` |
| Checkout | Address validation, cards, 3-D Secure, outage retry | `tests/web/checkout.web.spec.ts`, `tests/api/orders.api.spec.ts` |
| Orders | Lifecycle, cancellation, shipment, inbox | `tests/api/orders.api.spec.ts`, `tests/web/account.web.spec.ts` |
| Network | Request payloads, responses, delays, UI API errors | `tests/web/network.web.spec.ts` |
| Utilities | Upload, reports, status codes, checkout utilities | `tests/api/utility.api.spec.ts` |

## Mutating tests

Set `RUN_MUTATING_TESTS=true` for simulated orders and account changes.
Set `RUN_RESET_API_TEST=true` to run the opt-in `/api/reset` test.

## Known external behavior

- `410` is used for the expired `SUMMER25` promo.
- An order moves from `Processing` to `Shipped` approximately 15 seconds after
  creation.
- Demo carts, accounts, and orders are private and reset after inactivity.
- The Users API and Shop account API are separate account systems.
