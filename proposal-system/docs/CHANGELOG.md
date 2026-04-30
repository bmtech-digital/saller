# Changelog

All notable changes are documented here.

## 2026-04-30 — Per-type proposal templates (videos, agents)

Each project type now renders its own proposal PDF using its own template image and field set.

### Added
- Templates rasterized from the brand reference PDFs at 150dpi:
  - `frontend/public/contr/videos/page-{1,2}.jpg`
  - `frontend/public/contr/agents/page-{1,2}.jpg`
- New entries in `frontend/src/config/pdfCoordinates.ts`: `VIDEOS_COORDINATES`, `AGENTS_COORDINATES`, `AGENT_PACKAGES`, `BRAND_ORANGE`. Each variable position carries a `mask` rectangle used to white-out the example value baked into the rasterized template before drawing the new value on top.
- Three render functions in `pdfGenerator.ts` (`renderInfluencersPDF`, `renderVideosPDF`, `renderAgentsPDF`); the public `generateContractPDF` / `openContractPDF` / `downloadContractPDF` / `getContractPDFBase64` now accept a `projectType` argument and dispatch.
- `ContractForm` branches on `projectType`:
  - Influencers: unchanged (forText, platforms, whatYouGet, cost).
  - Videos: subject, packagePrice (default 6000), finalPrice (default 3800).
  - Agents: websiteName + a 4-button recommended-package selector.
- `ContractData` widened with optional per-type fields. No DB migration — `proposals.contract_data` is JSONB.

### Changed
- `ProposalEditorPage` reads `proposal.project_type` and threads it into both `ContractForm` and the PDF/send calls. Falls back to `'influencers'` when missing.
- `DashboardPage.handleDownloadPDF` reads `project_type` from the loaded proposal and forwards it to `openContractPDF`.

### Notes
- Coordinates are first-pass estimates from the rasterized templates. If anything looks misaligned in the rendered PDF, tweak the `mask` and `(x,y)` values in `pdfCoordinates.ts` — no other code changes needed.
- The agents template's package boxes (Basic / Advanced / Pro / Pro Max) are part of the image. We white-out all four checkbox squares and re-draw the outline, then fill only the recommended one with brand orange (`#F39200`). This keeps rendering deterministic regardless of which package the rasterized template happens to have pre-checked.

---

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
