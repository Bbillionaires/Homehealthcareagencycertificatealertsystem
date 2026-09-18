-- Run this ONCE against the Railway Postgres database, after applying
-- migrations, to create a least-privileged role the deployed app
-- connects as for normal request traffic.
--
-- Why this matters: Railway provisions a single Postgres role that OWNS
-- every table it creates, and Postgres exempts table owners from Row
-- Level Security by default. If the app keeps using that same owner
-- connection string in production, every RLS policy in
-- migrations/0001_init.sql is defined but silently bypassed -- tenant
-- isolation would then rest entirely on the application-layer checks in
-- lib/session.ts and every server action (which are real and already
-- enforced, but RLS is supposed to be the second, database-level line of
-- defense per docs/ARCHITECTURE.md). Connecting as a non-owner role like
-- this one is what makes RLS actually apply.
--
-- Never commit a real password. Generate one and pass it in via a psql
-- variable instead:
--
--   psql "$DATABASE_URL" \
--     -v app_user_password="$(openssl rand -base64 24)" \
--     -f db/create_app_role.sql
--
-- Then set the app's DATABASE_URL to the same host/port/database with
-- this role's credentials, and keep the original owner connection string
-- only for running migrations (`scripts/migrate`) -- never in the
-- running app.

create role app_user with login password :'app_user_password';

grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;

-- Keep tables/sequences added by future migrations covered automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public
  grant usage, select on sequences to app_user;
