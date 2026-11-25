# Practice API reference

This reference records the endpoint tables shared by the team. The tables show
paths and contracts, but do not identify their host/base URLs. The paths in this
reference were checked against the configured practice host,
`https://playwright-playground.com`. The project uses `API_BASE_URL` for API
requests and defaults it to `APP_BASE_URL`; confirm the correct host if using a
different environment.

These are practice APIs. Use only their provided demo data. Do not send real
passwords, personal information, or payment details.

## Shop API

| Method | Path | Contract and notes |
| --- | --- | --- |
| GET | `/api/shop/products` | Search/filter with `q`, `category`, `sort` (`featured`, `price-asc`, `price-desc`, `name`), and positive-integer `page`. Returns `products`, `page`, `pageSize`, `total`, and `totalPages`; invalid sort/page returns 400, an out-of-range page returns an empty list. |
| GET | `/api/shop/products/:slug` | One product, including options and reviews. |
| GET | `/api/shop/cart` | Requires an `X-Shop-Cart` header with 8–64 letters, digits, `-`, or `_`. `?delivery=express` adds express delivery pricing. |
| POST | `/api/shop/cart/items` | Body: `{ slug, quantity, option }`. Add a cart line. Quantity must be an integer from 1–99. Unknown products return 404, invalid options/quantities return 400, and sold-out or over-stock requests return 409. |
| PATCH / DELETE | `/api/shop/cart/items/:id` | Change a line's quantity or remove the line; an unknown line returns 404. |
| POST / DELETE | `/api/shop/cart/promo` | POST body: `{ code }` to apply `SAVE10`, `WELCOME20`, or `FREESHIP`; an unknown code returns 404 and expired `SUMMER25` returns 410. `WELCOME20` needs a $200 subtotal. DELETE removes the applied code. |
| POST | `/api/shop/register` | Body: `{ name, email, password }`; returns a token. |
| POST | `/api/shop/login` | Body: `{ email, password }`; returns a token. |
| GET | `/api/shop/me` | Read the signed-in account. |
| POST | `/api/shop/orders` | Requires an isolated `X-Shop-Cart` header. Body: `{ email, address, delivery, card, threeDS? }`. Returns 201 with an order and creates a confirmation inbox message. Invalid input/empty cart returns 400; failed payment or 3-D Secure challenge returns 402; provider timeout returns 504. Use practice-only card data. |
| GET | `/api/shop/orders` | Read the signed-in user's orders; requires a token. |
| GET | `/api/shop/orders/:id` | Read one of the signed-in user's orders; unknown or inaccessible orders return 404. |
| POST | `/api/shop/orders/:id/cancel` | Returns 200 when cancelling an order in `Processing`; returns 409 with `NOT_CANCELLABLE` after cancellation or shipment. |
| GET | `/api/shop/inbox` | `?email=` retrieves confirmation messages for that email address. Invalid or missing email returns 400; an unused valid email returns an empty message list. |

## Users API

| Method | Path | Contract and notes |
| --- | --- | --- |
| GET | `/api/users` | Returns `{ users: User[] }`; optional `?role=Admin`, `?role=Manager`, or `?role=User` filter. An unsupported role returns an empty list. |
| GET | `/api/users/:id` | Returns a user; non-numeric IDs return 400 and missing IDs return 404. |
| POST | `/api/users` | Body: `{ firstName, lastName, role }`; all fields required and role must be `Admin`, `Manager`, or `User`. Returns 201 with a `Location` header, or 400 for validation errors. |
| PUT | `/api/users/:id` | Replaces the user; every field is required. Returns 200, 400, or 404. |
| PATCH | `/api/users/:id` | Updates any subset of `firstName`, `lastName`, and `role`. Returns 200, 400, or 404. |
| DELETE | `/api/users/:id` | Returns 204 with no body, or 404. |

## Authentication and utility APIs

| Method | Path | Contract and notes |
| --- | --- | --- |
| POST | `/api/auth/login` | Body: `{ username, password }`; returns `{ token }` or 401. |
| GET | `/api/me` | Requires `Authorization: Bearer <token>`; returns `{ username, role }` or 401. |
| GET | `/api/products` | Returns `{ products: Product[] }`; optional `?search=text` and `?delay=ms` (maximum 10000). |
| GET | `/api/employees` | Read-only; optional `?search=text`, `?page=1`, and `?pageSize=5` (maximum 50). Returns employees and pagination metadata. |
| GET | `/api/notifications` | Returns `{ notifications: Notification[] }`. |
| GET | `/api/cities` | Returns up to 8 matches for `?search=text`; optional `?delay=ms`. |
| GET | `/api/usernames/:name` | Returns `{ username, available }`; names must contain 3–20 letters, digits, or underscores, otherwise 400. |
| POST | `/api/register` | Body: `{ email, age }`; validates only and stores nothing. Age must be an integer from 18–100. Returns 201, 400 for validation errors, or 409 when the email is taken. |
| POST | `/api/upload` | Multipart form with a `files` field; 2 MB total maximum. Files are read but not stored. Returns file metadata, 400, or 413. |
| GET | `/api/reports/monthly` | Returns a text file with `Content-Disposition: attachment`. |
| GET | `/api/checkout/cart` | Returns `{ items, subtotal }`. |
| GET | `/api/checkout/shipping` | Returns `{ shipping }`; intentionally takes about 1.5 seconds. |
| POST | `/api/checkout/pay` | Body: `{ total }`; returns 201 with a simulated payment, 400 `INVALID_TOTAL` for a missing/non-numeric total, or 422 `TOTAL_MISMATCH` when it does not match the cart plus shipping. Responses include `X-Request-Id`. |
| GET | `/api/checkout/payments/:id` | Returns `{ id, failed }`; `failed` is true for rejected demo payments. |
| GET | `/api/status/:code` | Responds with the requested HTTP status (200–599). |
| POST | `/api/reset` | Returns 204; restores the three seed users and signs out your tokens. Other visitors are not affected. |

## Authentication and test-data notes

- The authentication table documents `/api/auth/login` and `/api/me`; the Shop API separately documents `/api/shop/login`, `/api/shop/register`, and `/api/shop/me`. Confirm token compatibility rather than assuming these account systems are interchangeable. The published locked Shop account returns 403.
- Use only disposable accounts and data provided for the practice environment. Never use real payment details.
- Treat reset and payment routes as state-changing; use them only against the intended practice API.
- Automated checkout and the opt-in Orders API tests use the shop's published test-card data only. Tests exercise declined, insufficient-funds, expired, malformed, unlisted, timed-out, and 3-D Secure payments; failed payments must not create orders or consume the cart.
- The main opt-in Orders API flow creates, lists, reads, and cancels an order, then checks its inbox confirmation. Separate opt-in tests approve 3-D Secure and wait for an order to ship before verifying that cancellation returns 409. The shipment test leaves a simulated shipped order in the demo.
- A new order ships about 15 seconds after it is placed, so cancellation tests must act promptly.
- Each visitor's carts, accounts, and orders are private and reset after an hour without activity.
- The reset test is opt-in because it invalidates the current demo user's tokens.
