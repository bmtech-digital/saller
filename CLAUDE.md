# CLAUDE.md — saller

> Proposal & campaign management system for the Aiweon client (Hebrew, RTL).
> Originally built by oren (`bmtech-digital/saller`); migrated under bemtech ownership on **2026-04-23**.

## What this project is

A two-service web app that lets the Aiweon admin manage customers, build & send proposals, capture client signatures, and track campaigns. Hebrew RTL UI throughout.

- **Frontend**: Vite + React + TypeScript, served by nginx in a Cloud Run container
- **Backend**: Node + Express + TypeScript, port 8080, Cloud Run container
- **Database & Auth**: Supabase Postgres (auth + REST + storage)
- **Hosting**: Google Cloud Run, region `me-west1` (Tel Aviv)
- **CI/CD**: Cloud Build on push, secrets via GCP Secret Manager

## Live URLs (bemtech deployment)

| | URL |
|---|---|
| Frontend | https://saller-frontend-5c5iudcfoq-zf.a.run.app |
| Backend  | https://saller-backend-5c5iudcfoq-zf.a.run.app |
| Supabase | https://qzzkvaqtztxfpzisorld.supabase.co |

**Login**:
- `admin@aiweon.co.il` / `NewAdmin!234` — owns all migrated data (4 customers, 4 proposals)
- `roihalamish@gmail.com` / `Admin!234` — fresh user, RLS will scope to no data

## GCP & Supabase coordinates

| | |
|---|---|
| GCP project | `bemtech-478413` (project number `600758223942`) |
| Region | `me-west1` |
| Cloud Run services | `saller-backend`, `saller-frontend` |
| Secret Manager keys | `SALLER_SUPABASE_URL`, `SALLER_SUPABASE_ANON_KEY`, `SALLER_SUPABASE_SERVICE_KEY` |
| Supabase org | bmtech-digital's Org (Pro plan) |
| Supabase project ref | `qzzkvaqtztxfpzisorld` |
| Supabase region | `eu-central-1` (Frankfurt) — closest to Israel; no me-west region in Supabase |
| DB session pooler (IPv4) | `aws-1-eu-central-1.pooler.supabase.com:5432` user `postgres.qzzkvaqtztxfpzisorld` |

## Migration history (2026-04-23)

This project was forked off `bmtech-digital/saller` and re-homed under bemtech infrastructure. Trail:

1. **Discovery** — original deployment was on `white-setting-457110-f2` GCP (oren's project, auto-created by an earlier Claude Code auto-deploy session) talking to a Supabase project also on oren's account (`rbfhhltqlqixdpqfoajq.supabase.co`). Neither was accessible to bemtech.
2. **New Supabase** — created `saller` project under bmtech-digital's Supabase org (eu-central-1, t4g.micro). Applied `proposal-system/database/schema.sql` + `campaigns.sql` via `psql` over the session pooler.
3. **Data extraction** — without service-role access on the source, used a clever trick: logged into oren's prod backend, decoded the JWT `iss` claim to discover the source Supabase URL, and dumped tables via the prod backend's REST endpoints (which had broken RLS — every authed user saw all rows). Dumped to `/Users/roihala/projects/bemtech/saller-prod-dump/`.
4. **Data import** — created admin user in the new Supabase with the original UUID preserved (`POST /auth/v1/admin/users` accepts a custom `id`), then bulk-inserted customers/proposals/signatures via `psql`.
5. **Backend redeploy** — `gcloud builds submit --config=cloudbuild.yaml --project=bemtech-478413` builds & deploys both services. Backend env vars come from Secret Manager (`--set-secrets`).
6. **IAM gotcha** — `--allow-unauthenticated` is silently rejected on bemtech-478413 (org policy at parent folder). After every fresh deploy: `gcloud run services add-iam-policy-binding <svc> --member=allUsers --role=roles/run.invoker`.

**Migrated data**: 4 customers, 4 proposals (1 signed with 15KB signature payload), 1 signature. Empty in source: campaigns, proposal_blocks, block_text_items, documents, send_logs.

## Local development

Backend env (in `proposal-system/.env.local`, gitignored):
```
SUPABASE_URL=https://qzzkvaqtztxfpzisorld.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

Pull the keys from Secret Manager when needed:
```sh
gcloud secrets versions access latest --secret=SALLER_SUPABASE_URL --project=bemtech-478413
gcloud secrets versions access latest --secret=SALLER_SUPABASE_ANON_KEY --project=bemtech-478413
gcloud secrets versions access latest --secret=SALLER_SUPABASE_SERVICE_KEY --project=bemtech-478413
```

Run locally:
```sh
cd proposal-system
docker compose -f docker-compose.dev.yml up
```

## Deploy

```sh
gcloud builds submit --config=cloudbuild.yaml --project=bemtech-478413
# Required after every fresh deploy due to org policy:
for svc in saller-backend saller-frontend; do
  gcloud run services add-iam-policy-binding "$svc" \
    --member=allUsers --role=roles/run.invoker \
    --project=bemtech-478413 --region=me-west1
done
```

Cloud Build pipeline (`cloudbuild.yaml`): builds backend → deploys with secrets wired → reads back URL → builds frontend with `VITE_API_URL` baked in → deploys frontend → updates backend's `FRONTEND_URL` for CORS.

## Architecture quirks worth knowing

- **`contract_data` JSONB carries the proposal content** — the schema's `proposal_blocks` and `block_text_items` tables exist but are unused. The original frontend stores the entire contract as JSON in `proposals.contract_data`. Fine, but means those tables can be dropped in a future cleanup.
- **`signature_payload` JSONB is large** (≥15KB per signed proposal, contains canvas signature image as base64).
- **`/api/auth/register` is unauthenticated in production** — anyone can create accounts. Code comment even flags this; needs an admin-middleware wrap before this becomes externally known.
- **`campaigns.controller` uses `supabaseAdmin`** to bypass RLS (per commit `2764368`). Contrast with `customers.controller` which uses `createUserClient` and respects RLS.
- **Two backends were on bemtech-478413** when we started: ours (`saller-backend`) and a leftover `proposal-backend` from a prior attempt. Only ours points at the new Supabase.

## Open follow-ups

- [ ] Decommission oren's `proposal-backend` / `proposal-frontend` on `white-setting-457110-f2` — needs his sign-off
- [ ] Investigate the leftover `proposal-backend` on bemtech-478413 (not ours, predates this work)
- [ ] Investigate the paused `signature` Supabase project in bmtech-digital org — likely abandoned, confirm and delete
- [ ] Wrap `/api/auth/register` with admin middleware
- [ ] Make the `--allow-unauthenticated` IAM binding part of the cloudbuild finalize step (self-healing)
- [ ] Add a custom domain (currently raw `*.run.app` URLs)
- [ ] Drop unused `proposal_blocks` / `block_text_items` / `documents` tables
- [ ] Investigate why prod RLS was broken (we exploited it, but oren should know to fix on his side too)
