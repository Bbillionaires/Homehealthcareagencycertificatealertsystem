-- Phase 5 (draft template scaffolds) + Phase 7 (billing schema
-- scaffolding), per the multi-industry architecture directive
-- (docs/ARCHITECTURE.md §16). Both purely additive.

-- ---------------------------------------------------------------------
-- Draft template scaffolds for every non-Healthcare, non-Custom
-- industry. These exist so each industry has a real template_definitions
-- / template_versions row to attach requirements to later -- they
-- intentionally have ZERO template_requirements/template_positions
-- rows. This session has no verified regulatory source material for
-- Construction, Transportation, Childcare, Security, Education,
-- Government Contracting, or Staffing requirements, and the
-- architecture directive is explicit: never invent requirements, and
-- mark anything unverified as DRAFT/UNVERIFIED rather than presenting
-- it as regulatory. Only Healthcare has real content today
-- (DEFAULT_CREDENTIAL_TYPES, seeded per-organization at signup/workspace
-- creation -- see lib/organizations.ts and lib/workspaces.ts), and it
-- predates this template system, so it has no template_versions row of
-- its own yet either.
-- ---------------------------------------------------------------------
do $$
declare
  industry record;
  template_definition_id uuid;
begin
  for industry in
    select id, key from industry_definitions
    where key not in ('healthcare', 'custom')
  loop
    insert into template_definitions (industry_definition_id, key, name, description, status)
    values (
      industry.id,
      'draft-starter',
      'Starter Framework (Draft)',
      'Placeholder scaffold for this industry -- no requirements attached yet. Needs verified regulatory research before use.',
      'draft'
    )
    returning id into template_definition_id;

    insert into template_versions (template_definition_id, version_number, source, status, notes)
    values (
      template_definition_id,
      1,
      null,
      'draft',
      'DRAFT/UNVERIFIED: created as a framework placeholder only. Contains no requirements. Do not present to any organization as a regulatory checklist until real, sourced content has been added and this version is reviewed and published.'
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Billing schema scaffolding. No pricing is hard-coded anywhere here
-- (per the architecture directive) -- billing_plan_features is a
-- generic key/limit table so new billable dimensions (employees,
-- workspaces, locations, storage, advanced reports, SMS,
-- API/integrations, ...) can be added as data, not migrations. Nothing
-- here is wired to a payment processor; that integration is a later
-- phase.
-- ---------------------------------------------------------------------
create table billing_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger billing_plans_set_updated_at
  before update on billing_plans
  for each row execute function set_updated_at();

-- One row per billable dimension a plan limits or enables, e.g.
-- ('employees', '25'), ('industry_workspaces', '1'), ('locations', null
-- for unlimited), ('sms_notifications', 'false' for a boolean feature
-- flag rather than a numeric limit). limit_value is text so it can hold
-- either a number or a simple flag without a schema change per feature.
create table billing_plan_features (
  id uuid primary key default gen_random_uuid(),
  billing_plan_id uuid not null references billing_plans(id) on delete cascade,
  feature_key text not null,
  limit_value text,
  created_at timestamptz not null default now(),
  unique (billing_plan_id, feature_key)
);

create index billing_plan_features_plan_idx on billing_plan_features(billing_plan_id);

create type organization_subscription_status as enum ('active', 'trialing', 'past_due', 'canceled');

create table organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  billing_plan_id uuid not null references billing_plans(id),
  status organization_subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index organization_subscriptions_plan_idx on organization_subscriptions(billing_plan_id);

create trigger organization_subscriptions_set_updated_at
  before update on organization_subscriptions
  for each row execute function set_updated_at();

alter table organization_subscriptions enable row level security;

create policy organization_subscriptions_select on organization_subscriptions
  for select using (is_org_member(organization_id));
create policy organization_subscriptions_write on organization_subscriptions
  for all using (is_org_owner(organization_id)) with check (is_org_owner(organization_id));

-- Seed a single, unlimited "Founding" plan so every organization has a
-- row to reference (organization_subscriptions.billing_plan_id is
-- NOT NULL) without inventing real pricing tiers. No feature limits are
-- attached -- an empty billing_plan_features set means "unlimited" by
-- convention (checked in application code, not enforced by this table).
insert into billing_plans (key, name, description, sort_order) values
  ('founding', 'Founding', 'Full access while QualifyStaff''s plan structure and pricing are finalized.', 1)
on conflict (key) do nothing;

do $$
declare
  founding_plan_id uuid;
  org record;
begin
  select id into founding_plan_id from billing_plans where key = 'founding';

  for org in select id from organizations loop
    insert into organization_subscriptions (organization_id, billing_plan_id, status)
    values (org.id, founding_plan_id, 'active')
    on conflict (organization_id) do nothing;
  end loop;
end;
$$;
