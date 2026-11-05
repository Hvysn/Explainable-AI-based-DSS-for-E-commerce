# Security & Authentication

This project previously performed authentication entirely in the browser (plaintext
passwords, hardcoded PINs/invite codes, `localStorage` user databases). That model
has been removed. Authentication is now enforced by a server-side gateway, and all
business APIs require a valid session.

## Architecture

```
Browser (React client / static dashboard)
        │  credentials: include + Bearer token
        ▼
Express Auth Gateway :5000  ── issues HS256 JWT (iss=jhj-auth, aud=jhj-dss)
        │  shared JWT_SECRET
        ▼
FastAPI Decision API :8000  ── verifies JWT on every protected route
                              ── checkout ingress requires X-API-Key
```

- **Single issuer:** only the Express gateway mints tokens.
- **Single verifier contract:** FastAPI validates `iss`, `aud`, signature, expiry,
  token type and the user's `tokenVersion` (revoked on password/2FA changes).
- **No credentials in the frontend:** both UIs send credentials to the gateway and
  keep only a session token (static dashboard) or rely on the httpOnly cookie
  (React client).

## Controls implemented

| Area | Control |
| --- | --- |
| Passwords | bcrypt hashes (`BCRYPT_ROUNDS`, default 12), min 8 chars + letter + number |
| 2FA answers | bcrypt hashes, normalized and never returned by the API |
| Sessions | Short-lived HS256 JWT, `iss`/`aud` checked, `tokenVersion` revocation |
| Token transport | `httpOnly`, `SameSite=Lax` cookie; optional `Authorization: Bearer` |
| 2FA challenge | Separate `type=2fa` JWT with a 5-minute lifetime |
| Registration | Invite code compared with `crypto.timingSafeEqual` |
| Creator actions | Authenticated **and** `isCreator` role **and** master PIN |
| Account updates | Require current password; rotate token version afterwards |
| API authorization | JWT required for queue, actions, metrics and copilot |
| Checkout ingress | `X-API-Key` header (fail-closed if unset) |
| CORS | Explicit allow-list; wildcard + credentials is no longer possible |
| Headers | Helmet on Express; `nosniff`, `DENY`, `no-referrer`, `no-store` on FastAPI |
| Abuse | `express-rate-limit` on auth and global routes |
| Input validation | `zod` schemas (Express) and constrained Pydantic models (FastAPI) |
| Secrets | Environment only (`.env`, Docker secrets); `.env` is gitignored |
| User store | File mode `0600`, atomic writes; replace with a real DB in production |

## First-time setup

```bash
cp .env.example .env
# Generate strong secrets and paste them into .env:
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # INGEST_API_KEY
# Set TEAM_INVITE_CODE, CREATOR_MASTER_PIN and SEED_ADMIN_* in .env
```

The first Creator account is seeded **only when the user store is empty**, from
`SEED_ADMIN_*`. Sign in with those values, then immediately change the password
and 2FA challenge from **My Security & 2FA**.

### Run locally

```bash
# 1. Auth gateway
cd server && npm install && npm start        # :5000

# 2. FastAPI (loads the same .env)
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000

# 3. React client
cd client && npm install && npm run dev      # :3000, proxies /api -> :5000
```

### Run with Docker

`docker compose up --build` reads `.env` for every service. The user store is kept
in the `auth_data` volume. Nginx proxies the dashboard's `/api` calls to the auth
gateway so cookies stay first-party.

## API surface

Public:
- `GET /api/health` (Express)
- `GET /` (FastAPI liveness)
- `POST /api/auth/step1`, `POST /api/auth/step2`
- `POST /api/auth/register-teammate` (invite code required)

Authenticated (JWT):
- `GET /api/auth/me`
- `GET /api/team`
- `POST /api/team/verify-creator` (Creator only)
- `PUT /api/user/security` (self only)
- `GET /api/v1/warehouse/queue`
- `POST /api/v1/warehouse/action`
- `GET /api/v1/warehouse/metrics`
- `POST /api/v1/copilot/chat`

Ingress API key:
- `POST /api/v1/orders/checkout`

## Before production

1. Terminate TLS in front of every service and set `NODE_ENV=production` so the
   auth cookie gets the `Secure` flag.
2. Rotate `JWT_SECRET`, `INGEST_API_KEY`, the invite code and the Creator PIN.
3. Replace the file-backed user store with a database with unique constraints and
   backups (the module boundary is `server/store.js`).
4. Put a reverse proxy / WAF in front of the auth gateway and keep rate limits.
5. Keep `.env` out of images and source control; prefer a secrets manager.
6. The static dashboard keeps the JWT in `sessionStorage` because it can be opened
   from `file://`; prefer serving it behind Nginx (cookie transport) and add a
   strict Content-Security-Policy for production.
7. Add refresh-token rotation or re-authentication for very long sessions.
