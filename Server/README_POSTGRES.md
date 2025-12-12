Postgres development helper (SwiftCargo Server)

This file documents local Postgres setup convenience scripts added to `package.json` and how the server will try to auto-create a missing database.

Scripts (from `Server/package.json`):

- `npm run pg:docker`

  - Starts a local Postgres container named `swiftcargo-postgres`:
    ```bash
    docker run --name swiftcargo-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=swiftcargo -p 5432:5432 -d postgres:15
    ```

- `npm run pg:docker-stop`

  - Stops and removes the container started above.

- `npm run dev:docker`
  - Convenience: starts the Postgres container and then runs the server (note: the server may try to start before Postgres is fully ready; if so, wait a few seconds and restart or use `npm run dev`).

Environment variables

The server reads Postgres connection info from environment variables (or `.env` via `dotenv`):

```
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=swiftcargo
PGADMIN_DB=postgres   # optional; maintenance DB to use when creating PGDATABASE
ADMIN_SECRET_TOKEN=Waterside
PORT=8080
```

Auto-create behavior

- On startup the server will attempt a simple query against the configured database. If Postgres returns error code `3D000` (database does not exist), the server will attempt to connect to the `PGADMIN_DB` (defaults to `postgres`) and run `CREATE DATABASE <PGDATABASE>`.
- For the auto-create to succeed the configured user must have permission to create databases. If not, create the database manually or run the Docker helper.

Manual DB creation (psql):

```bash
psql -h localhost -U postgres -c "CREATE DATABASE swiftcargo;"
```

Security note

- Do not commit real credentials to the repository. Use `.env` locally and secure secrets in production.

If you want, I can add a small script to poll the Postgres port until ready before starting the server, or add a health-check loop for `dev:docker` to wait until Postgres accepts connections.
