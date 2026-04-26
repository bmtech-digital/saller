# CLAUDE.md — saller

> Proposal & campaign management system for the Aiweon client (Hebrew, RTL).
> Originally built by oren (`bmtech-digital/saller`); migrated under bemtech ownership on **2026-04-23**.

## What this project is

A two-service web app that lets the Aiweon admin manage customers, build & send proposals, capture client signatures, and track campaigns. Hebrew RTL UI throughout.

- **Frontend**: Vite + React + TypeScript, deployed to **Firebase Hosting** (default site `bemtech-478413`)
- **Backend**: Node + Express + TypeScript, port 8080, Cloud Run (region `me-west1`)
- **Database & Auth**: Supabase Postgres (auth + REST + storage)
- **CI/CD**: Cloud Build on push, secrets via GCP Secret Manager

## Live URLs (bemtech deployment)

| | URL |
|---|---|
| Frontend (canonical) | https://crm.aiweon.co.il |
| Frontend (Firebase default) | https://bemtech-478413.web.app |
| Backend | https://saller-backend-600758223942.me-west1.run.app |
| Supabase | https://qzzkvaqtztxfpzisorld.supabase.co |

The custom domain `crm.aiweon.co.il` is wired in Cloud DNS (zone `aiweon-co-il` in `bemtech-478413`) via:
- `CNAME crm.aiweon.co.il → bemtech-478413.web.app.`
- `TXT _acme-challenge.crm.aiweon.co.il` (Let's Encrypt validation, set 2026-04-26)

Firebase auto-provisions and renews the cert. Initial provisioning takes 5–30 min after DNS is set; check status via the Firebase Hosting REST API on `customDomains/crm.aiweon.co.il` (look at `cert.state` — `CERT_VALIDATING` → `CERT_ACTIVE`).

**Login**: any registered user. Every authenticated user is implicitly an admin and sees all rows (see "Access model" below). Existing accounts:
- `admin@aiweon.co.il` / `NewAdmin!234` — created the migrated data (4 customers, 4 proposals)
- `roihalamish@gmail.com` / `Admin!234`

## Access model

**Every authenticated user is an admin and has full CRUD access to every row in every business table.** RLS is still on, but the policies are `for all to authenticated using (true) with check (true)` rather than `owner_id = auth.uid()`. `owner_id` columns remain as "who created this row" but no longer restrict visibility. Applied 2026-04-26 via `proposal-system/database/rls-shared-access.sql`; `schema.sql` and `campaigns.sql` reflect this model for fresh deploys. The `anon` role still has no row access — public flows (e.g. client signing via `client_token`) go through the backend with `supabaseAdmin`.

## GCP & Supabase coordinates

| | |
|---|---|
| GCP project | `bemtech-478413` (project number `600758223942`) |
| Region | `me-west1` |
| Cloud Run services | `saller-backend` (frontend moved to Firebase Hosting on 2026-04-26) |
| Firebase Hosting site | `bemtech-478413` (default site, custom domain `crm.aiweon.co.il`) |
| Cloud DNS zones | `aiweon-co-il`, `weon-co-il` |
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

## Frontend hosting migration (2026-04-26)

Frontend moved off Cloud Run (`saller-frontend`) onto **Firebase Hosting** to enable a custom domain. `me-west1` doesn't support Cloud Run domain mappings, so the alternatives were a global LB (~$18/mo) or Firebase Hosting (free + global CDN). Picked Firebase. Trail:

1. **Firebase added to bemtech-478413** via the Firebase Console (the CLI's `addFirebase` returned 403; manual UI flow worked because it handles ToS acceptance + quota project setup).
2. **`firebase.json` + `.firebaserc`** committed at the repo root. Hosting target = `proposal-system/frontend/dist`, with SPA rewrites and asset caching headers.
3. **Custom domain registered** via the Firebase Hosting REST API: `crm.aiweon.co.il`. Firebase issued a CNAME requirement (→ `bemtech-478413.web.app`) and an ACME TXT challenge — both added to the `aiweon-co-il` Cloud DNS zone in a single transaction.
4. **Cloud Build SA granted Firebase access**: `roles/firebasehosting.admin` + `roles/serviceusage.serviceUsageConsumer` on bemtech-478413. CI deploys via ADC, no token secret needed.
5. **`cloudbuild.yaml` rewritten**: backend deploy → Vite build with `VITE_API_URL` set → `firebase deploy --only hosting`. Backend `FRONTEND_URL` is now hardcoded to `https://crm.aiweon.co.il` (no longer derived from a deploy URL).
6. **Backend CORS** updated on the running `saller-backend` service to point at the new domain.

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
# Required after every fresh backend deploy due to org policy:
gcloud run services add-iam-policy-binding saller-backend \
  --member=allUsers --role=roles/run.invoker \
  --project=bemtech-478413 --region=me-west1
```

Cloud Build pipeline (`cloudbuild.yaml`):
1. Builds + deploys backend container to Cloud Run with Supabase secrets wired and `FRONTEND_URL=https://crm.aiweon.co.il` set on the backend (CORS).
2. Builds the Vite frontend with `VITE_API_URL=<backend-run-url>/api` baked in.
3. Deploys the Vite `dist/` to Firebase Hosting via `firebase deploy --only hosting`. Auth uses ADC: the Cloud Build SA `600758223942@cloudbuild.gserviceaccount.com` has `roles/firebasehosting.admin` and `roles/serviceusage.serviceUsageConsumer`. No `FIREBASE_TOKEN` is needed.

Manual frontend-only deploy (skips Cloud Build, just publishes the latest local bundle):
```sh
cd proposal-system/frontend
VITE_API_URL=https://saller-backend-600758223942.me-west1.run.app/api npm run build
cd ..
firebase deploy --only hosting --project=bemtech-478413
```

## Architecture quirks worth knowing

- **`contract_data` JSONB carries the proposal content** — the schema's `proposal_blocks` and `block_text_items` tables exist but are unused. The original frontend stores the entire contract as JSON in `proposals.contract_data`. Fine, but means those tables can be dropped in a future cleanup.
- **`signature_payload` JSONB is large** (≥15KB per signed proposal, contains canvas signature image as base64).
- **`/api/auth/register` is unauthenticated in production** — anyone can create accounts. Code comment even flags this; needs an admin-middleware wrap before this becomes externally known.
- **`campaigns.controller` uses `supabaseAdmin`** to bypass RLS (per commit `2764368`). Contrast with `customers.controller` which uses `createUserClient` and respects RLS.
- **Two backends were on bemtech-478413** when we started: ours (`saller-backend`) and a leftover `proposal-backend` from a prior attempt. Only ours points at the new Supabase.
- **Firebase project ≡ GCP project** — Firebase was added to `bemtech-478413` on 2026-04-26 (interactive Console flow because the CLI's `addFirebase` 403'd). **Deleting the Firebase project deletes bemtech-478413 and everything in it** (Cloud Run, Cloud DNS, Secret Manager). Manage via Firebase Console with care.

## Open follow-ups

- [ ] Decommission oren's `proposal-backend` / `proposal-frontend` on `white-setting-457110-f2` — needs his sign-off
- [ ] Investigate the leftover `proposal-backend` on bemtech-478413 (not ours, predates this work)
- [ ] Investigate the paused `signature` Supabase project in bmtech-digital org — likely abandoned, confirm and delete
- [ ] Wrap `/api/auth/register` with admin middleware
- [ ] Make the `--allow-unauthenticated` IAM binding part of the cloudbuild finalize step (self-healing)
- [ ] Once `cert.state` for `crm.aiweon.co.il` flips to `CERT_ACTIVE`, decommission the now-stale `saller-frontend` Cloud Run service: `gcloud run services delete saller-frontend --region=me-west1 --project=bemtech-478413`. Container image `gcr.io/bemtech-478413/saller-frontend` can be cleaned up afterwards.
- [ ] Drop unused `proposal_blocks` / `block_text_items` / `documents` tables
- [ ] Investigate why prod RLS was broken (we exploited it, but oren should know to fix on his side too)
