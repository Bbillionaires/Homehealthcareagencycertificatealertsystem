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
│   ├── shared/        Compliance engine, Zod schemas, shared types,
│   │                  formatting helpers — imported by web, mobile, jobs
│   └── database/      Generated Supabase types, query helpers
├── supabase/
│   ├── migrations/     SQL migrations (source of truth for schema)
│   ├── functions/      Edge Functions: daily compliance job, notification
│   │                  dispatch                                 [Phase 4/7]
│   └── seed.sql        Demo data
└── docs/
```

- **Backend**: Supabase (Postgres 17 + Auth + Storage + Row Level Security).
  No separate REST/GraphQL server — Next.js Route Handlers / Server Actions
  and the mobile app both talk to Supabase directly (via the anon key +
  RLS) or through thin Route Handlers when server-only logic (compliance
  calculation, audit logging, cross-record renewal transactions) is
  required. This keeps one authorization surface (Postgres RLS) instead of
  duplicating auth checks in an app server.
- **Database**: Postgres via Supabase, multi-tenant, RLS-enforced.
- **Auth**: Supabase Auth (email/password, password reset, session via
  httpOnly cookies on web / secure storage on mobile).
- **Storage**: Supabase Storage, private buckets, signed URLs only.
- **Compliance engine**: pure, framework-free functions in
  `packages/shared/src/compliance`, unit-tested, used identically by web
  pages, mobile screens, the nightly job, and report generation — the one
  place status logic lives.
- **Background jobs**: Supabase Edge Functions on a cron schedule (daily
  compliance recalculation + notification dispatch), calling the same
  shared compliance engine.
- **Notifications**: `notifications` table (in-app) + email via a
  transactional provider (Resend) triggered from the same job; push/SMS
  are additive channels on the same table (see §7).

## 2. Multi-Organization / Tenant Isolation

Every business table has `organization_id uuid not null references organizations(id)`.
Isolation is enforced in Postgres via Row Level Security, not just in
application code:

- `is_org_member(org_id uuid) returns boolean` — `security definer` helper,
  checks `organization_users` for the calling `auth.uid()`.
- `current_org_role(org_id uuid) returns text` — returns the caller's role
  key ('owner' | 'office_manager' | 'employee') within that org, or null.
- `current_employee_id(org_id uuid) returns uuid` — for employee-role
  users, the `employee_id` they're linked to; used to scope self-service
  reads/writes.

All policies key off these functions rather than duplicating the join
logic per table, and are defined in the same migration as each table so
tenant isolation ships with the schema, never as an afterthought.

## 3. Database Schema

See `supabase/migrations/0001_init.sql` for the authoritative definition.
Summary:

| Table | Purpose |
|---|---|
| `organizations` | Tenant root |
| `organization_settings` | Compliance color thresholds, notification schedule, timezone |
| `roles` | Owner / Office Manager / Employee — a table, not an enum, so more can be added without a migration |
| `organization_users` | Links `auth.users` → org → role → optional `employee_id` (employee portal login) |
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

- Supabase Auth for identity; RLS for every authorization decision at the
  data layer (§2) — the frontend never being the last line of defense.
- Private Storage buckets; all document access via short-lived signed
  URLs generated server-side after an RLS-backed permission check.
- Service-role key used only in server-only contexts (Route Handlers,
  Edge Functions), never shipped to the browser or the mobile bundle.
- Zod validation at every server entry point (Route Handlers, Server
  Actions) in addition to Postgres constraints.
- Audit log is insert-only (no `UPDATE`/`DELETE` grants to any
  non-service role).
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
/(app)/employees/[id]/credentials/[credentialTypeId]/renew
/(app)/calendar                          day/week/month, color-coded
/(app)/reports                           list of report types → filters → export
/(app)/notifications
/(app)/audit-log                         Owner only
/(app)/settings/organization
/(app)/settings/credential-types
/(app)/settings/positions
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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
RESEND_API_KEY=                    # transactional email
NEXT_PUBLIC_APP_URL=
# Future, additive:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

No live Supabase project is provisioned yet. `supabase/migrations` and
`supabase/seed.sql` are ready to apply to a project once one is connected
(`supabase link` + `supabase db push`, or via the Supabase MCP tools).

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
