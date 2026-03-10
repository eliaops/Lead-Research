# BidToGo — Technical Rules

All architecture, code, scraper, and data rules in one place. Read `project_context.md` first for product vision and current state.

---

## 1. Architecture

### Data Pipeline (Sacred)

```
source → crawler → parser → normalizer → scorer → deduplicator → database → API → frontend
```

- Scrapers must not write to DB without normalization and scoring.
- API routes must not modify opportunity data directly — they read from DB and write user-generated data (notes, saved searches).
- Frontend must not query sources directly — all data comes through API routes.

### Service Boundaries

| Service | Runtime | Responsibility |
|---------|---------|----------------|
| **Web App** | Node.js (Next.js) | Dashboard UI, API routes, auth, DB via Prisma |
| **Scraper Service** | Python (FastAPI + Celery) | Crawling, parsing, scoring, AI analysis, DB via SQLAlchemy |

- Web ↔ scraper communication: HTTP only (FastAPI endpoints).
- Both share PostgreSQL. Prisma owns the schema definition; Python uses SQLAlchemy for reads/writes.
- Redis is shared broker. Both use namespaced keys.

### Technology Ownership

| Concern | Owner |
|---------|-------|
| Database schema | `apps/web/prisma/schema.prisma` (single source of truth) |
| Full-text search | Raw SQL in `prisma/setup-search.sql` (Prisma can't define tsvector) |
| API endpoints | Next.js API Routes (`apps/web/src/app/api/`) |
| Scraping logic | Python (`services/scraper/src/`) |
| Relevance scoring | Python (`services/scraper/src/utils/scorer.py`) |
| UI components | React + shadcn/ui (`apps/web/src/components/`) |

---

## 2. Code Standards

### General

- Prefer small, targeted changes over large rewrites.
- Every function does one thing. Every file has a single responsibility.
- No dead code: no commented-out blocks, no placeholder functions, no unused imports.
- Shared logic goes in utility modules — never duplicate across files.

### TypeScript (apps/web/)

- Strict TypeScript. No `any` — use `unknown` + type guards.
- `import type { ... }` for type-only imports.
- API routes: `try/catch` wrapper, Zod validation, parameterized SQL, consistent response shapes (`{ data, total, page }` for lists; `{ error, details }` for errors).
- Convert Prisma `Decimal` → `Number()`, `Date` → `.toISOString()` in responses.
- React: `"use client"` for hooks/browser APIs. Handle loading/error/empty states in every data component. Use `cn()` for conditional classes, `lucide-react` for icons, shadcn/ui for primitives.
- Prisma: import from `@/lib/prisma` singleton. Use `$queryRawUnsafe()` with parameterized placeholders for tsvector queries. Never interpolate user input.

### Python (services/scraper/)

- Python 3.9+. `from __future__ import annotations` in files using `Type | None`.
- Pydantic v2 for all cross-module data structures.
- Type hints on all function signatures.
- `logging` via project logger — never `print()` in production.
- `pathlib.Path` for file paths.

### Database

- Prisma owns the schema. UUIDs for PKs (`gen_random_uuid()`). UTC timestamps (`TIMESTAMPTZ`).
- Default to NOT NULL. Nullable fields need explicit reason.
- Never drop columns without checking all references.
- Additive changes are safe. Destructive changes require migration plan: add new → backfill → update code → drop old.
- `search_vector` tsvector column defined in `setup-search.sql`, must be re-applied after table recreation. Weights: title (A), summary (B), full (C).

### API Contracts

- TypeScript types in `apps/web/src/types/index.ts` are the contract between backend and frontend.
- Existing fields must not be removed/renamed without updating all consumers.
- New fields may be added without breaking changes.

---

## 3. Scraper Rules

### Safety (Non-Negotiable)

The scraper must **never**:
- Access pages behind login, CAPTCHA, paywall, or access control
- Bypass anti-bot systems or impersonate human browsers
- Override robots.txt disallow directives
- Send requests faster than configured rate limit (minimum 1s enforced)
- Scrape personal data of private individuals
- Follow links to domains not in the source registry

Before every crawl: check robots.txt (cached 24h), enforce rate limit, verify domain is registered, enforce max_pages.

### User-Agent

```
BidToGo/1.0 (+https://bidtogo.ca/bot; bot@bidtogo.ca)
```

### Crawler Design

Crawlers extend `BaseCrawler`. They **fetch pages and handle navigation** — they do not parse HTML, score, or write to DB.

Config-driven via `crawl_config` (listing_url, pagination type, rate_limit_seconds, max_pages, timeout, headers). A generic crawler handles 80% of sources; source-specific crawlers only for unusual navigation. Default: 3s delay, 20 max pages, 30s timeout.

On HTTP 429: exponential backoff. On 404/403: log and skip.

### Parser Design

Parsers extend `BaseParser`. They **extract structured data from HTML** — they do not fetch pages, score, or write to DB.

CSS selectors and XPath as constants at file top or in `crawl_config` — never inline in logic.

Required output fields: `title` (required), `source_url` (required). Everything else optional: `external_id`, `organization`, `description`, `location_raw`, `country`, `region`, `city`, `posted_date`, `closing_date`, `status`, `estimated_value`, `currency`, `category`, `contact_*`, `documents`.

### Normalization

- Dates → Python `datetime` via `python-dateutil`. Store closing dates with timezone (default: source local). Posted dates date-only. Unparseable → `None`.
- Country → 2-letter ISO (`CA`, `US`). Region → abbreviation (`ON`, `BC`, `TX`). City → title-case, trimmed.
- Text → strip HTML tags, excess whitespace, control chars. Unicode NFC.
- Status → enum: open, closed, awarded, cancelled, unknown.

### Deduplication

Two layers: source-level (`UNIQUE(source_id, external_id)`) + content-level (`UNIQUE(fingerprint)` — SHA-256 of `title + source_url`). Every opportunity must have a fingerprint before insertion. Upsert on conflict: preserve existing.

### Logging

Every crawl run creates a `source_runs` record: pending → running → completed/failed, with `pages_crawled`, `opportunities_found/created/updated/skipped`, `error_message`, `duration_ms`.

Log every HTTP request at INFO (`GET url → status (time, size)`). Log errors at ERROR with URL and context. Never log full HTML, credentials, or personal data.

### Adding a New Source

1. Add to `data/sources.yaml` with metadata
2. Register in database (seed script or dashboard)
3. Write parser in `services/scraper/src/parsers/` — selectors as constants
4. Test with saved HTML fixture
5. Write source-specific crawler only if generic can't handle it
6. Test end-to-end via FastAPI endpoint

---

## 4. Error Handling

- **API routes**: `try/catch`, structured errors `{ error, details }`, proper HTTP codes (400/404/500), server-side logging with context.
- **Scrapers**: handle timeouts, HTTP errors, empty/malformed HTML. Retry transient errors (timeout, 503) up to 3× with backoff. Skip permanent errors (404, 403). Always update `source_runs` with failure state.
- **Frontend**: loading/error/empty states everywhere. Catch `fetch()` failures and show user-friendly messages.

---

## 5. Testing

| Component | Test Type | Priority |
|-----------|-----------|----------|
| Relevance scorer | Unit: known inputs → expected scores | High |
| Normalizer | Unit: date parsing, location extraction | High |
| Deduplicator | Unit: fingerprint generation | High |
| Parsers | Unit: saved HTML fixtures → extracted fields | High |
| API routes | Integration: seeded DB → correct responses | Medium |
| Frontend | Manual browser testing (future: Playwright E2E) | Medium |

Test fixtures in `services/scraper/tests/fixtures/`. Never make real HTTP requests in tests.
