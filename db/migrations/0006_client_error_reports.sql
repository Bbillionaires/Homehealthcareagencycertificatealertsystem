-- Client-side crashes were previously invisible: Next.js's generic
-- "Application error: a client-side exception has occurred" message
-- gives a tester nothing to report and gives us nothing to debug
-- against. global-error.tsx now best-effort POSTs every uncaught
-- client exception here. No organization_id / RLS -- a crash can
-- happen before a session exists (e.g. on the login page itself), so
-- this has to accept reports from a logged-out request, same reasoning
-- as sessions/password_reset_tokens not being tenant-scoped.
create table client_error_reports (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  digest text,
  stack text,
  url text not null,
  user_agent text,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_error_reports_created_at_idx on client_error_reports(created_at desc);
