## Quick orientation for AI coding agents

This repository contains a React + Vite frontend and a Flask backend. The goal of these instructions is to capture the concrete, discoverable patterns and workflows an AI agent needs to be productive here.

### Big-picture architecture
- Frontend: `/frontend` — React + Vite app. Dev scripts are in `frontend/package.json` (use `npm run dev`).
- Backend: `/backend` — Flask application using the application-factory pattern in `backend/app.py`. Routes are organized as Blueprints under `backend/routes/` and models under `backend/models/`.
- API surface is namespaced under `/api` (see `register_blueprints()` in `backend/app.py`):
  - Auth: `/api/auth` (blueprint `auth_bp` in `backend/routes/auth.py`)
  - Houses: `/api/houses` (blueprint `house_bp`)
  - Bookings, Admin, Owner, Payments, Payment-proofs are all registered similarly.

### Key files to reference (examples)
- `backend/app.py` — app factory, JWT + CORS setup, blueprint registration, lightweight migration checks.
- `backend/routes/auth.py` — registration, login, JWT usage, phone normalization rules and user-type-specific flows.
- `backend/requirements.txt` — pinned Python dependencies (Flask, Flask-JWT-Extended, Flask-SQLAlchemy, SendGrid, stripe, etc.).
- `backend/README_SENDGRID.md` — how SendGrid is wired and which env vars it expects.
- `frontend/package.json` — `dev`, `build`, `preview` scripts.
- Static assets: `backend/static/house_images` and `backend/static/payment_proofs`.

### Concrete developer workflows & commands
- Backend (local development):
  1. Install deps: `pip install -r backend/requirements.txt`.
  2. Set environment variables (recommended via a `.env` file or your shell):
     - `SQLALCHEMY_DATABASE_URI` (DB connection)
     - `JWT_SECRET_KEY` (JWT signing)
     - `SENDGRID_API_KEY`, `FROM_EMAIL`, `FRONTEND_BASE_URL` (if sending emails)
  3. Run: `python backend/app.py` (the project creates `app = create_app(...)` at import time).

- Backend (production): run behind a WSGI server. Example: `gunicorn -w 4 -b 0.0.0.0:5000 backend.app:app`

- Frontend:
  - Install: `cd frontend && npm install`
  - Dev: `npm run dev` (Vite dev server)
  - Build: `npm run build` (produces static assets to serve from a web server)

- Quick test scripts (curl-based): `backend/test_auth.sh`, `backend/test_all_endpoints.sh` — useful for smoke-testing a locally-running API.

### Project-specific conventions and gotchas (must-know)
- Blueprints are registered with explicit URL prefixes in `backend/app.py`. New route files should export a Blueprint named `<feature>_bp` and be registered in `register_blueprints()`.
- Authentication uses `Flask-JWT-Extended`. Tokens are returned as `access_token`/`refresh_token` and must be supplied as `Authorization: Bearer <token>`.
- Phone normalization: `backend/routes/auth.py` implements a strict normalizer that accepts local `07x...` or international `+263.../263.../00263...` and converts to a 10-digit local string starting with `07`. Examples:
  - `+263771234567` -> `0771234567`
  - `771234567` -> `0771234567`
  - Only prefixes `071`, `077`, `078` are accepted.

- Student accounts must verify email before login (`user.email_verified` is enforced on login). Email verification flow uses a token sent by `utils/email_utils.py` and the frontend `FRONTEND_BASE_URL` to build links.

- House-claiming flows: When registering as `house_owner`, frontend must send `house_number`, `street_address`, and `residential_area` (ID or name). The backend resolves area by id or case-insensitive name and then finds the exact house by normalized fields.

- Lightweight migrations: `create_tables()` in `backend/app.py` performs simple `ALTER TABLE` checks at startup (adds missing columns). There is `Flask-Migrate` in `requirements.txt` but migrations are not present — be careful when changing schema.

### Integration points
- Email: SendGrid (see `backend/README_SENDGRID.md`). Env vars: `SENDGRID_API_KEY`, `FROM_EMAIL`, `FRONTEND_BASE_URL`.
- Payments: `stripe` is a dependency — payment handling code is in `backend/routes/payment.py` and `backend/routes/payment_proofs.py`.
- Mapbox: frontend uses `mapbox-gl` for maps.

### Debugging and tests
- Use the provided shell scripts under `backend/` to perform end-to-end smoke tests (they expect the API at `http://localhost:5000`). They call real endpoints and assume the DB is in a predictable state.
- Useful endpoints:
  - `/api/health` — simple health check
  - `/api` — API root listing registered endpoints
  - `/api/auth/profile` — requires valid JWT

### Security notes the agent must respect
- Do not expose or suggest committing secrets (API keys, DB URIs, admin passwords). Test scripts include example credentials — do not hardcode secrets in PRs.
- The SendGrid integration is best-effort and will noop if `SENDGRID_API_KEY` is not set; still, avoid including keys in any changes.

### Examples to reference in changes or PRs
- To add a new API blueprint: follow the pattern in `backend/routes/auth.py` and register it in `backend/app.py` using a `*_bp` Blueprint and `url_prefix='/api/<feature>'`.
- To create a migration-safe change: prefer adding nullable columns with defaults and update `create_tables()` as needed; document schema changes in PRs.

If any section feels incomplete or you need more detail (for example, exact config variables in `backend/config.py` or model shapes in `backend/models/`), tell me which area you want expanded and I will update this file.
