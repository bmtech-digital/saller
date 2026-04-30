# Changelog

All notable changes are documented here.

## 2026-04-30 — Project types

Proposals and campaigns are now scoped by **project type**: `influencers`, `videos`, `agents` (default `influencers`). Types are defined once in `frontend/src/config/projectTypes.ts`.

### Added
- `project_type` ENUM column on `proposals` and `campaigns` (Postgres). Indexed.
- Sidebar dropdowns: one per type, each with "ההצעות שלי" + "הצעה חדשה" carrying `?type=<id>`.
- `CustomersPage`: project-type filter pills; per-customer derived type label; "העלאת חשבונית" button when a campaign has no invoice (one-shot file picker → `PATCH /campaigns/:id`).
- `CampaignForm`: "סוג פרוייקט" select. Defaults to the active filter when set.
- `pdfGenerator.ts`: עבור text now centered, wrapped as `קמפיין עבור "<value>"`.

### Changed
- `GET /proposals` and `GET /campaigns/customer/:id` accept `?project_type=` filter.
- `POST /proposals` and `POST /campaigns/customer/:id` accept `project_type` in body (validated; falls back to default).
- `Layout.tsx` no longer hardcodes a single משפיענים dropdown — dropdowns are generated from `PROJECT_TYPES`.

### Migration
The DB migrations are idempotent. Apply on the Cloud SQL `proposal_system` DB:

```bash
# From a host with Cloud SQL Proxy or via Cloud Console SQL editor
psql -f database/schema-cloudsql.sql   # adds project_type ENUM + column to proposals (IF NOT EXISTS)
psql -f database/campaigns.sql         # adds project_type column to campaigns (IF NOT EXISTS)
```

Existing rows are backfilled to `'influencers'` via the column default.

### Deferred
- Per-type PDF templates / coordinate maps — single template for now; branching point ready (`proposal.project_type` available at render time).
- Per-type contract field schemas (videos may not need `platforms`, etc.).

See `docs/plans/project-types.md` for the design.
