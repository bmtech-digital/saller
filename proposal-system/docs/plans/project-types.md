# Project Types

System now supports proposals and campaigns scoped by **project type**.

## Types

Defined in `frontend/src/config/projectTypes.ts`:

| ID            | Label (he) |
| ------------- | ---------- |
| `influencers` | משפיענים   |
| `videos`      | סרטונים    |
| `agents`      | אייגנטים   |

Default for backfill and missing values: `influencers`.

To add a new type later: add an entry to `PROJECT_TYPES` (and to the `ProjectType` union in `frontend/src/types/index.ts`, `backend/src/types/index.ts`, and the `project_type` Postgres ENUM). UI picks it up automatically — sidebar generates one dropdown per type, customers page generates one filter pill per type.

## Data model

- `proposals.project_type` — Postgres ENUM `project_type`, NOT NULL, default `'influencers'`.
- `campaigns.project_type` — same.
- Indexed on both tables for type-scoped queries.

Migrations are idempotent (`ADD COLUMN IF NOT EXISTS`), safe to re-run on existing deployments.

## Routing & UX

- Sidebar: one collapsible dropdown per project type, each contains:
  - "ההצעות שלי" → `/?type=<id>`
  - "הצעה חדשה" → `/proposals/new?type=<id>`
- `DashboardPage` reads `?type=` and passes it to `GET /proposals?project_type=<id>`.
- `NewProposalPage` reads `?type=` and includes `project_type` in the create payload. Defaults to `influencers` when missing.
- `CustomersPage` is a single page (`/customers`) with a project-type filter row at the top. Filter is **client-side** — applied to customers based on whether they have any campaign of that type. Switching to "All" shows everyone.

## Customer page invoice upload

When a campaign has no `invoice_url`, the cell renders a "העלאת חשבונית" button (instead of `-`). Clicking opens a hidden file input → reads as base64 data URL → `PATCH /campaigns/:id { invoice_url }`. Validation matches `CampaignForm` (image or PDF, ≤5 MB). One shared hidden `<input>` element is reused for all rows via `pendingInvoiceUploadRef`.

## What did NOT change in this pass

- **PDF templates**: still a single template (`/contr/page-*.jpg`). Per-type templates and coordinate maps will come once the user supplies designs for `videos` and `agents`. The `project_type` field is already on the proposal so PDF generation can branch later without another migration.
- **Per-type form fields**: `ContractData` still has `platforms` etc. that are influencer-specific. When per-type forms are introduced, they'll branch on `proposal.project_type`.
- **Customer page filter is client-side**: works fine for current scale (customers + their campaigns are already loaded eagerly). If the dataset grows, push the filter to the backend via `?project_type=` on `GET /customers`.

## Follow-ups

- Per-type PDF template + coordinate map (waits on design).
- Per-type defaults in `ContractData` (e.g. videos may not need `platforms`).
- Show project-type badge on the proposals table rows on `DashboardPage` for "All types" view (currently the filter is dropdown-driven so the column is implicit).
