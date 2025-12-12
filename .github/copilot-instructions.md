# Copilot / AI Agent Instructions — SwiftCargo

This file contains concise, actionable information to help an AI coding agent be productive in this repository.

## Big picture

- Single-process Node.js Express app serving a static front-end from `Client/` and persisting package data to `Server/db.json`.
- Server entry: `Server/index.js` (ES modules, `"type": "module"` in `Server/package.json`).
- Front-end is a static site under `Client/` (HTML/CSS/vanilla JS). The server serves it with `express.static`.

## Major components & data flow

- `Server/index.js`:
  - Loads/saves an in-repo JSON DB at `Server/db.json` (not a real DB). Look for `loadPackages()` / `savePackages()`.
  - Exposes API endpoints:
    - `POST /register-package` — Admin-only (Bearer token). Body accepts either JSON or application/x-www-form-urlencoded keys (forms use kebab-case like `sender-name`). Responds with `{ trackingNumber }`.
    - `POST /update-status` — Admin-only. Expects `tracking-number`, `new-status`, `location`, `update-description`.
    - `GET /track/:trackingNumber` — Public. Returns package object with `shipmentInfo`, `status`, `location`, `history`.
    - `POST /send-message` and `POST /contact` — simple contact endpoints that log and return success.
  - Authentication: very simple token check using `ADMIN_SECRET_TOKEN = 'Waterside'` (hardcoded). Tests and automation should provide `Authorization: Bearer <token>`.

## Project-specific patterns & conventions

- Server expects both JSON and urlencoded form submissions; `express.json()` and `express.urlencoded({ extended: true })` are enabled.
- Form field names from `Client/admin.html` use kebab-case (e.g., `sender-name`, `receiver-address`). Server code maps these to `sender` / `receiver` objects.
- Tracking IDs are generated as `SC` + uppercase `nanoid(10)` (e.g., `SCZC7WYRA2DJ`). Data model includes `shipmentInfo` and `history` entries with `timestamp`.
- The repository uses ES modules. Use `import` syntax when editing server files.

## Dev / run / debug workflows (discoverable)

- Install & run server (from `Server/`):

```bash
cd Server
npm install
npm start        # runs `node index.js` (default PORT 8080)
# OR for auto-reload during development:
npx nodemon index.js
# To change port (bash):
PORT=3000 npm start
```

- Open the site at `http://localhost:8080/` and admin at `http://localhost:8080/admin`.
- Admin pages prompt for the admin token (see `Client/admin.js`). Provide `Waterside` or set `ADMIN_SECRET_TOKEN` in server and use that in the admin prompt.

## Examples (use these when producing code changes or tests)

- Example register request (JSON):

```http
POST /register-package HTTP/1.1
Host: localhost:8080
Authorization: Bearer Waterside
Content-Type: application/json

{
  "sender-name": "Alice",
  "sender-email": "a@example.com",
  "receiver-name": "Bob",
  "origin": "Shanghai, China",
  "destination": "London, UK",
  "weight": "1.2",
  "eta": "2025-12-12"
}
```

- Example track GET (public):

```bash
curl http://localhost:8080/track/SCZC7WYRA2DJ
```

## Files to inspect for context when changing behavior

- `Server/index.js` — core logic, routing, and DB persistence.
- `Server/db.json` — canonical persisted dataset (useful for tests/fixtures).
- `Server/package.json` — runtime flags (ES modules) and start script.
- `Client/admin.html` & `Client/admin.js` — show how admin UI posts data and how token is provided (prompt).
- `Client/track-result.js` & `Client/script.js` — front-end lookup, error handling, and UI expectations (query param `id`, fields used from server response).

## Safety / gotchas (explicit, discoverable)

- The admin token is hardcoded in `Server/index.js`. Any agent making changes that touch auth should preserve existing behavior or move to environment variables and document the change (do not silently remove the token).
- `Server/db.json` is the single source-of-persistence — concurrent writes are not coordinated. Avoid adding multi-process behavior unless you migrate to a proper DB and update README/tests.
- Because timestamps in `db.json` may be strings, client code expects ISO strings when rendering dates. Preserve that format when writing history entries.

## When making PRs / edits

- Run the server locally (see commands above) and exercise the admin flows in `Client/admin.html` to produce realistic `db.json` changes.
- Keep edits minimal and ES-module compatible. Update `Server/package.json` only if you add new Node features that require different runtime flags.

---

If any of the sections above are unclear or you'd like more examples (test curl requests, a small unit test harness, or a dev `nodemon` script), tell me which area to expand and I will iterate.
