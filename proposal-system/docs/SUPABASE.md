# Supabase Access

The saller proposal system uses Supabase for both Postgres and PostgREST. This doc covers how to talk to it from the CLI, run schema migrations, and where credentials live.

> **Secrets policy**: Supabase keys (anon, service, PAT) and the database password are **never** stored in this repo. They live in macOS Keychain (CLI session) and GCP Secret Manager (`SALLER_SUPABASE_*`, project `bemtech-478413`). Don't add them to docs, env files, or commits.

## Project

| | |
|---|---|
| Project ref | `qzzkvaqtztxfpzisorld` |
| Project URL | `https://qzzkvaqtztxfpzisorld.supabase.co` |
| Region | Central EU (Frankfurt) |
| Org | `veognpbhhmnhdwyxiwth` |
| Dashboard | https://supabase.com/dashboard/project/qzzkvaqtztxfpzisorld |

GCP Secret Manager mappings (consumed by `cloudbuild.yaml`):

| Secret | Used as |
|---|---|
| `SALLER_SUPABASE_URL` | `SUPABASE_URL` |
| `SALLER_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` |
| `SALLER_SUPABASE_SERVICE_KEY` | `SUPABASE_SERVICE_KEY` |

```bash
# Read a secret
gcloud secrets versions access latest --secret=SALLER_SUPABASE_URL --project=bemtech-478413
```

## Supabase CLI

The CLI is installed at `/usr/local/bin/supabase`. Auth token is stored in the macOS Keychain entry **"Supabase CLI"** — never on disk in the repo. To check session:

```bash
supabase projects list   # should include `saller` (qzzkvaqtztxfpzisorld)
```

If not authenticated:

```bash
supabase login   # opens a browser; the resulting PAT is written to Keychain
```

### Linking the saller project

The first time you run a DB-touching command in a working directory, link it:

```bash
cd /Users/roihala/projects/bemtech/saller
supabase link --project-ref qzzkvaqtztxfpzisorld
# prompts once for the database password — that password is the one set when
# the Supabase project was created (or rotated under Settings → Database)
```

The DB password is cached in Keychain after the first link.

## Applying schema migrations

The `database/*.sql` files in this repo are the **source of truth** for schema. They are written to be idempotent (`CREATE TYPE IF NOT EXISTS` patterns, `ADD COLUMN IF NOT EXISTS`), so re-running them is safe.

### Option A — Supabase dashboard SQL Editor (no CLI needed)

1. Open https://supabase.com/dashboard/project/qzzkvaqtztxfpzisorld/sql/new
2. Paste the migration SQL.
3. Click **Run**.

Recommended for one-off changes when you don't have the DB password handy.

### Option B — `supabase db push` via the CLI (preferred for repeatable migrations)

This requires a `supabase/migrations/` directory with timestamped `.sql` files. To create one:

```bash
cd /Users/roihala/projects/bemtech/saller
mkdir -p supabase/migrations
# Name files YYYYMMDDHHMMSS_description.sql
cp proposal-system/database/<file>.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_<description>.sql
supabase db push
```

`supabase db push` uses the linked project + cached DB password to apply migrations.

### Option C — direct `psql` (when you already have the DB password)

```bash
# Pooler (recommended — survives IPv4 restrictions)
psql "postgres://postgres.qzzkvaqtztxfpzisorld:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f proposal-system/database/<file>.sql
```

## Inspecting state

```bash
# Schema diff against the linked project
supabase db diff

# Pull the live schema down
supabase db pull

# Read tables via PostgREST (uses the anon key)
curl "$(gcloud secrets versions access latest --secret=SALLER_SUPABASE_URL --project=bemtech-478413)/rest/v1/proposals?select=id,project_type&limit=5" \
  -H "apikey: $(gcloud secrets versions access latest --secret=SALLER_SUPABASE_ANON_KEY --project=bemtech-478413)"
```

## Common pitfalls

- **Two Postgres dialects in this repo**: `database/schema.sql` is the original Supabase variant; `database/schema-cloudsql.sql` is the (currently unused) Cloud SQL variant. The live DB is Supabase — use `schema.sql` patterns or the targeted migration SQL files (`campaigns.sql`, `influencers.sql`).
- **`supabase db push` against an unlinked dir**: will hang waiting for project ref. Always `link` first.
- **Service key in client code**: never. The frontend gets the anon key only; the service key is server-only and only injected via Secret Manager.
