-- Phase 6 (platform-admin template management), starting point: a flag
-- marking a user as a QualifyStaff platform administrator, distinct
-- from any organization's owner/admin roles. Nobody is granted this by
-- default -- it's set manually against the database when a real
-- platform administrator needs it, the same way db/create_app_role.sql
-- is a manual, deliberate step rather than something signup grants.
alter table users add column is_platform_admin boolean not null default false;
