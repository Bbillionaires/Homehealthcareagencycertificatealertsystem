# Employee Credential, Training & Compliance Management Platform

Architecture, schema, and phase plan. Written before implementation per the
project's development-process requirements; kept up to date as the system
grows.

## 1. Technical Architecture

```
compliance-platform/
├── apps/
│   ├── web/          Next.js 14 (App Router) + TypeScript + Tailwind
│   └── mobile/        Expo (React Native) + TypeScript          [Phase 9]
├── packages/
│   └── shared/        Compliance engine, Zod schemas, shared types,
│                       formatting helpers — imported by web, mobile, jobs
├── db/
│   ├── migrations/     SQL migrations (source of truth for schema)
│   ├── create_app_role.sql  One-time least-privilege Postgres role setup
│   └── seed.sql        Local dev demo data
└── docs/
```

- **Backend**: a Railway Postgres service, talked to directly from Next.js
  Route Handlers / Server Actions via `pg` (no ORM, no separate REST/GraphQL
  server) — there is no hosted backend-as-a-service product in the loop.
  The mobile app (Phase 9) will go through the same Next.js server rather
  than connecting to Postgres itself, since it has no way to hold a raw
  `pg` connection or enforce the session model below.
- **Database**: plain Postgres 17 on Railway, multi-tenant, RLS-enforced
  (see §2 for how RLS works without a hosted auth product in front of it).
- **Auth**: self-hosted — `users`/`sessions`/`password_reset_tokens` tables
  (§2), scrypt password hashing (`lib/auth/password.ts`), opaque
  session tokens in an httpOnly cookie (`lib/auth/session.ts`), password
  reset emailed via Resend (falls back to a server-console log locally).
- **Storage**: a Railway bucket (S3-compatible object storage), private,
  accessed only via server-generated presigned URLs — same access
  pattern Supabase Storage would have given us, just via
  `@aws-sdk/client-s3` against Railway's S3-compatible endpoint instead
  of the Supabase client. Wired up in Phase 6 alongside the rest of
  document management; not needed for Phase 1.
- **Compliance engine**: pure, framework-free functions in
  `packages/shared/src/compliance`, unit-tested, used identically by web
  pages, mobile screens, the nightly job, and report generation — the one
  place status logic lives. Entirely database-agnostic, so this backend
  swap touched zero lines of it.
- **Background jobs**: a scheduled Railway service (cron-triggered deploy,
  or a long-running worker with an internal scheduler) running the daily
  compliance recalculation + notification dispatch, calling the same
  shared compliance engine. (There is no Supabase Edge Functions
  equivalent to lean on; this is plain Node.)
- **Notifications**: `notifications` table (in-app) + email via a
  transactional provider (Resend) triggered from the same job; push/SMS
  are additive channels on the same table (see §7).
- **Migrations**: no CLI/hosted migration product either — `db/migrations/*.sql`
  are applied in order by `apps/web/scripts/migrate.mjs` (`pnpm db:migrate`),
  which tracks what's already run in a `schema_migrations` table so
  re-running is a no-op.

## 2. Multi-Organization / Tenant Isolation

Every business table has `organization_id uuid not null references organizations(id)`.
Isolation is enforced in Postgres via Row Level Security, not just in
application code -- but RLS has no JWT/PostgREST layer to read a caller's
identity from here the way it would with Supabase, so the app sets it
explicitly:

- Every request that touches an org-scoped table runs inside
  `withUserContext(userId, ...)` (`lib/db/context.ts`), which opens a
  transaction and runs `select set_config('app.current_user_id', $1, true)`
  before the real query -- `true` scopes it to that transaction only, so
  it can never leak across a pooled connection to a different request.
- `current_user_id() returns uuid` reads that setting back
  (`nullif(current_setting('app.current_user_id', true), '')::uuid`) --
  this is the direct replacement for Supabase's `auth.uid()`.
- `is_org_member(org_id uuid) returns boolean` — `security definer` helper,
  checks `organization_users` for `current_user_id()`.
- `current_org_role(org_id uuid) returns text` — returns the caller's role
  key ('owner' | 'office_manager' | 'employee') within that org, or null.
- `current_employee_id(org_id uuid) returns uuid` — for employee-role
  users, the `employee_id` they're linked to; used to scope self-service
  reads/writes.

All policies key off these functions rather than duplicating the join
logic per table, and are defined in the same migration as each table so
tenant isolation ships with the schema, never as an afterthought.

**The one manual step this requires**: Railway provisions a single Postgres
role that owns every table it creates, and Postgres exempts table owners
from RLS by default. If the deployed app keeps using that same owner
connection string, every policy above is defined but silently bypassed --
tenant isolation would then rest entirely on the application-layer checks
in `lib/session.ts` and every server action (which are real, and are
themselves a genuine authorization boundary, but RLS is supposed to be
the second, database-level line of defense). Run `db/create_app_role.sql`
once (instructions in that file) to create a non-owner `app_user` role,
and point the deployed app's `DATABASE_URL` at that role rather than the
Railway-provisioned owner string, which should be kept only for running
migrations. This is called out again in §9 and belongs on the Phase 10
hardening checklist.

The bootstrap/signup path (creating a brand-new organization when no
membership row exists yet to satisfy the usual policies) does not need a
service-role bypass: `organizations` has a permissive `INSERT ... WITH
CHECK (true)` policy (creating a new tenant is the intended entry point),
and `organization_users` has a bootstrap policy that lets a user insert
their own membership row into an org that currently has zero members --
i.e. claiming ownership of the org they just created. Every insert after
that (`organization_settings`, `credential_types`, the audit log entry)
runs in the same transaction and now passes the normal `is_org_admin()`
check because that membership row already exists. See
`lib/organizations.ts`.

## 3. Database Schema

See `db/migrations/0001_init.sql` for the authoritative definition.
Summary:

| Table | Purpose |
|---|---|
| `users` | Account identity: email + scrypt password hash. Not org-scoped, not RLS-protected -- the trust root the rest of the schema's RLS is built on, only ever touched by server-only auth code |
| `sessions` | Opaque session tokens (hashed) backing the httpOnly cookie |
| `password_reset_tokens` | One-hour, single-use password reset tokens (hashed) |
| `organizations` | Tenant root |
| `organization_settings` | Compliance color thresholds, notification schedule, timezone |
| `roles` | Owner / Office Manager / Employee — a table, not an enum, so more can be added without a migration |
| `organization_users` | Links `users` → org → role → optional `employee_id` (employee portal login) |
| `departments` | Org-scoped department list |
| `positions` | Org-scoped job positions |
| `employees` | Employee profile (§4 fields) |
| `credential_types` | Configurable requirement/credential catalog (§5) |
| `position_requirements` | Which credential types a position requires |
| `employee_credentials` | Versioned credential records; renewals archive the old row instead of overwriting (§7) |
| `credential_documents` | Document version history per credential record |
| `notification_rules` | Configurable alert schedule, global or per credential type |
| `notifications` | Generated alert instances (in-app/email/push/sms), deduped |
| `audit_logs` | Append-only action log |

Dates are stored as `date` (not `timestamptz`) for completion/issue/
expiration — these are calendar-date facts, not instants — while all
`created_at`/`updated_at`/event columns are `timestamptz`. Expiration math
uses calendar-date arithmetic (`date + interval 'N years'`), never
fixed-day addition, so leap years and month-length don't shift renewal
dates.

## 4. Employee Fields

`employee_number, first_name, middle_name, last_name, preferred_name,
date_of_hire, position_id, department_id, supervisor_id (self-fk),
employment_status (active|leave|inactive|terminated), phone, email,
photo_url, notes, created_by, updated_by, created_at, updated_at`.

## 5. Credential/Requirement Type Catalog (seeded, editable)

| Key | Category | Default renewal | Requires document |
|---|---|---|---|
| `cpr` | training | 2 years | yes |
| `first_aid` | training | 2 years | yes |
| `hipaa` | training | 1 year | yes |
| `zero_tolerance` | training | 3 years | yes |
| `hiv_aids_101` | training | admin-configurable (default 2 years) | yes |
| `direct_care_core_competencies` | training | admin-configurable (default 1 year) | yes |
| `letter_of_moral_character` | document | none (one-time; admin-configurable) | yes |
| `local_background_check` | background_check | 5 years | yes |
| `fdle_background_check` | background_check | 5 years | yes |

Renewal interval is `(renewal_interval_value int, renewal_interval_unit
'days'|'months'|'years')`, nullable = never expires once completed.
Administrators can add/rename/deactivate types, change intervals, mark
required/optional, assign to positions, and set per-type warning-period
overrides — all through `credential_types` / `position_requirements` rows,
no code changes.

Expiration is always computed from the credential's own
`completion_date`/`issue_date`, never from `date_of_hire`. Hire date is
only used to seed the new-hire checklist (§ Page Map, Employee Detail).

## 6. Compliance Status Rules

`calculateCredentialStatus(completionDate, expirationDate, thresholds)`:

- No record for a required credential → `MISSING` (gray)
- `expirationDate` null and completed → `CURRENT` (never-expiring type)
- `daysRemaining > thresholds.yellowThresholdDays` (default 90) → `CURRENT` (green)
- `orangeThresholdDays < daysRemaining <= yellowThresholdDays` (default 60–90) → `EXPIRING_SOON` (yellow)
- `0 < daysRemaining <= orangeThresholdDays` (default 1–59) → `URGENT` (orange)
- `daysRemaining <= 0` → `EXPIRED` (red)

Thresholds live in `organization_settings`, overridable per credential
type. `calculateEmployeeCompliance(employee, credentials, requirements)`
takes the **worst** status among all *required* credentials as the
employee's overall status (an expired mandatory item always wins over a
high completion percentage), and separately reports a completion
percentage for display. Every status carries a color token, an icon name,
and a text label — never color alone (accessibility).

## 7. Renewal Workflow

Renewing a credential is a transaction: archive the current
`employee_credentials` row (`status='archived'`, `superseded_by` = new
row id), insert the new active row, keep the old row's documents in
`credential_documents` with `is_current=false`, write an `audit_logs`
entry, and let the next compliance job pick up the new expiration date.
Nothing is ever deleted or overwritten — audits need the full history.

## 8. Notification Architecture

- **Schedule**: `notification_rules` (global default + optional per
  credential-type override) drives a days-before list, default
  `{90,60,30,14,7,0}`, plus continued (non-duplicated) alerts while a
  credential stays expired.
- **Dedup**: each generated notification gets a `dedupe_key` (e.g.
  `credential:<id>:milestone:<days>`), unique per org — reruns of the
  nightly job are idempotent.
- **Channels**: `notifications.channel text[]` — `in_app` always;
  `email` sent via a transactional provider from the same job;
  `push`/`sms` columns and channel plumbing exist now so Expo push tokens
  and Twilio can be added later without a schema change.
- **Recipients**: Owner + Office Manager always eligible; Employee gets
  their own; `notification_rules.notify_roles` configurable per rule.

## 9. Security Architecture

- Self-hosted session auth (§1/§2): scrypt-hashed passwords, opaque
  session tokens (only their SHA-256 hash is stored), httpOnly/secure/
  SameSite=Lax cookie, session revocation on password reset. RLS for
  every authorization decision at the data layer (§2) — the frontend
  never being the last line of defense.
- Private bucket storage (Phase 6); all document access via short-lived
  presigned URLs generated server-side after the same permission check
  used elsewhere, never a public/predictable path.
- `DATABASE_URL` used only in server-only contexts (Route Handlers,
  Server Actions, the migration/seed scripts, the future background
  job), never shipped to the browser or the mobile bundle. Production
  should use the least-privileged `app_user` role from
  `db/create_app_role.sql`, not the Railway-provisioned owner role --
  see the callout in §2.
- Zod validation at every server entry point (Server Actions) in
  addition to Postgres constraints.
- Audit log is insert-only (no `UPDATE`/`DELETE` grants to any role).
- IDs are UUIDv4 (non-enumerable) everywhere user-facing.

## 10. Role / Permission Matrix

| Capability | Owner | Office Manager | Employee |
|---|---|---|---|
| View/edit organization settings, roles, credential type catalog | ✅ | ❌ | ❌ |
| Manage users / invite admins | ✅ | ❌ | ❌ |
| Add/edit employees | ✅ | ✅ | ❌ |
| Enter/renew credentials, upload documents | ✅ | ✅ | own uploads only, when requested |
| View all employees & compliance | ✅ | ✅ | ❌ (self only) |
| View own profile/credentials/notifications | ✅ | ✅ | ✅ |
| Run/export reports | ✅ | ✅ | ❌ |
| View audit log | ✅ | ❌ | ❌ |
| Override expiration date | ✅ | ❌ (needs Owner) | ❌ |

## 11. Web Page Map

```
/login  /signup  /reset-password
/(app)/dashboard                         cards, upcoming/recent, filters
/(app)/employees                         search + filters (name/ID/position/dept/status/compliance)
/(app)/employees/new
/(app)/employees/[id]                    tabs: Overview, Training & Credentials,
                                          Background Checks, Documents, History, Notes
/(app)/employees/[id]/edit
/(app)/employees/[id]/credentials/[credentialTypeId]/renew
/(app)/employees/[id]/credentials/[credentialTypeId]/override   Owner only, reason required (§7)
/(app)/calendar                          day/week/month, color-coded
/(app)/reports                           list of report types → filters → export
/(app)/notifications
/(app)/audit-log                         Owner only
/(app)/settings/organization             thresholds + notification schedule (editable)
/(app)/settings/credential-types         catalog CRUD, renewal interval, warning overrides (Owner only)
/(app)/settings/positions                position CRUD + per-position requirement matrix (Owner only)
/(app)/settings/users
/(app)/settings/notifications
/(app)/import/employees
/(app)/profile                           self-service view for Employee role
```

## 12. Mobile Screen Map (Phase 9)

```
Tab bar: Home · Employees · Compliance · Calendar · Notifications · Profile
Home                dashboard summary cards
Employees           list/search (Owner/Manager only)
Employees/[id]       same tabs as web, condensed
Credential capture   camera/photo-library → preview → confirm → upload
Compliance           org-wide status board (Owner/Manager) or personal (Employee)
Calendar             month/week/day
Notifications        list, mark read
Profile/Settings     account, notification preferences, sign out
Employee-only mode: nav collapses to Home · My Credentials · Notifications · Profile
```

## 13. Development Phases

1. Architecture, database, auth — **this change**
2. Employee management (CRUD, search/filter, CSV import)
3. Credential management (records, renewal workflow, documents)
4. Compliance engine wiring (shared package → dashboard/report consumption)
5. Dashboard + color-coded statuses, calendar
6. Document management (versioning, signed URLs, mobile capture)
7. Notifications (in-app, email templates, background job)
8. Reporting (CSV/PDF export)
9. Mobile application (Expo)
10. Testing hardening, security review, deployment prep

Each phase ends with lint + typecheck + tests green before moving on.

## 14. Environment Variables / External Services

```
DATABASE_URL=                      # Railway Postgres; owner role for migrate/seed,
                                    # app_user role (db/create_app_role.sql) in production
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=                    # transactional email (password reset today; Phase 7 notifications later)
EMAIL_FROM=
# Future, additive:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
RAILWAY_BUCKET_ENDPOINT=           # Phase 6 document storage
RAILWAY_BUCKET_NAME=
RAILWAY_BUCKET_ACCESS_KEY_ID=
RAILWAY_BUCKET_SECRET_ACCESS_KEY=
```

No live Railway project is provisioned yet. `db/migrations` and
`db/seed.sql` are ready to apply the moment one is connected: set
`DATABASE_URL` to the Postgres service's connection string and run
`pnpm db:migrate` (and, for local dev only, `pnpm db:seed`).

## 15. Business-Rule Decisions Made By Default (revisit if wrong)

These were resolved as configuration rather than blocking questions, per
the brief's instruction not to block on anything the software can make
configurable:

- Letter of Moral Character defaults to "never expires once completed";
  admins can set a renewal interval if their agency wants one.
- HIV/AIDS 101 and Direct Care Core Competencies default to a 2-year and
  1-year renewal respectively (admin-editable) since no default was
  specified.
- Compliance color thresholds default to the suggested 90/60/59/0-day
  boundaries, stored per-org and overridable per credential type.
