-- Phase 1 of multi-industry support (see docs/ARCHITECTURE.md).
--
-- Strategy: purely additive. Nothing existing is dropped, renamed, or
-- re-pointed in this migration -- every currently-working page, RLS
-- policy, and query keeps working unchanged. This migration:
--
--   1. Introduces the ORGANIZATION -> INDUSTRY WORKSPACE -> LOCATION
--      layer alongside (not instead of) the existing organization-scoped
--      tables.
--   2. Introduces the canonical requirement/template system
--      (requirement_definitions, template_definitions/versions/
--      requirements/positions) as reference data, decoupled from any
--      one organization.
--   3. Introduces workspace_requirements, employee_workspace_assignments,
--      employee_position_assignments, and requirement_evidence_links as
--      the workspace-scoped analogues of today's org-scoped
--      credential_types / employees.position_id / employee_credentials.
--   4. Adds a nullable workspace_id to positions, credential_types,
--      position_requirements, employee_credentials, and
--      notification_rules so existing rows can be backfilled into a
--      workspace without changing their current (organization-scoped)
--      behavior. Cutting these over to be workspace-scoped -- new RLS,
--      new unique constraints, retiring credential_types in favor of
--      workspace_requirements -- is Phase 2, done once the UI/routing
--      that depends on it exists.
--
-- Every new table follows the same conventions as 0001_init.sql: uuid
-- primary keys, created_at/updated_at with the existing set_updated_at()
-- trigger, and RLS policies mirroring is_org_member()/is_org_admin().

-- ---------------------------------------------------------------------
-- roles: three new workspace-scoped role keys, alongside the existing
-- organization-scoped owner/office_manager/employee.
-- ---------------------------------------------------------------------
insert into roles (key, name, description, is_system) values
  ('workspace_admin', 'Workspace Administrator', 'Full access to one industry workspace''s configuration and data.', true),
  ('workspace_manager', 'Workspace Manager', 'Manages employees, requirements, and documents within one industry workspace.', true),
  ('workspace_employee', 'Workspace Employee', 'Self-service access to own records within one industry workspace.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- industry_definitions: the fixed catalog of industries QualifyStaff
-- supports (plus "custom" for organizations building their own).
-- Reference data, not tenant-specific -- no organization_id, no RLS.
-- ---------------------------------------------------------------------
create table industry_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_custom boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger industry_definitions_set_updated_at
  before update on industry_definitions
  for each row execute function set_updated_at();

insert into industry_definitions (key, name, description, is_custom, sort_order) values
  ('healthcare', 'Healthcare', 'Home health, group homes, and other direct-care agencies.', false, 1),
  ('construction', 'Construction', 'General contractors and trade employers.', false, 2),
  ('transportation', 'Transportation', 'Motor carriers and drivers subject to DOT/FMCSA requirements.', false, 3),
  ('childcare', 'Childcare', 'Daycare centers and early-childhood providers.', false, 4),
  ('security', 'Security', 'Licensed security guard and investigation services.', false, 5),
  ('education', 'Education', 'Schools and educational service providers.', false, 6),
  ('government_contracting', 'Government Contracting', 'Contractors subject to government clearance/eligibility requirements.', false, 7),
  ('staffing', 'Staffing', 'Staffing agencies placing workers across client industries.', false, 8),
  ('custom', 'Other / Custom', 'A fully configurable workspace for an industry QualifyStaff has not templated yet.', true, 99)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- industry_workspaces: ORGANIZATION -> ONE OR MORE INDUSTRY WORKSPACES.
-- ---------------------------------------------------------------------
create type industry_workspace_status as enum ('active', 'archived');

create table industry_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  industry_definition_id uuid not null references industry_definitions(id),
  name text not null,
  slug text not null,
  status industry_workspace_status not null default 'active',
  -- Set when this workspace was created by adopting a template version;
  -- null for a from-scratch Custom workspace. Kept even if the template
  -- version is later retired, as provenance for "what this was built
  -- from" (see template_update_decisions for later version changes).
  source_template_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index industry_workspaces_org_idx on industry_workspaces(organization_id);
create index industry_workspaces_industry_idx on industry_workspaces(industry_definition_id);

create trigger industry_workspaces_set_updated_at
  before update on industry_workspaces
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- workspace_memberships: WORKSPACE-LEVEL permissions, separate from
-- organization_users' organization-level role. An organization Owner
-- gets implicit access to every workspace in their org (see
-- is_workspace_member() below) without needing a row here; every other
-- workspace-scoped role (workspace_admin/workspace_manager/
-- workspace_employee) is explicit.
-- ---------------------------------------------------------------------
create table workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references industry_workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id),
  employee_id uuid references employees(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_memberships_workspace_idx on workspace_memberships(workspace_id);
create index workspace_memberships_user_idx on workspace_memberships(user_id);

create trigger workspace_memberships_set_updated_at
  before update on workspace_memberships
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS helper functions for the workspace layer, mirroring
-- is_org_member()/is_org_admin()/is_org_owner() from 0001_init.sql.
-- An organization owner is always a workspace member/admin of every
-- workspace in their org; a workspace_admin/workspace_manager row
-- grants access to that one workspace only.
-- ---------------------------------------------------------------------
create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from industry_workspaces w
    where w.id = target_workspace_id
      and (
        is_org_member(w.organization_id)
        and (
          is_org_owner(w.organization_id)
          or exists (
            select 1 from workspace_memberships wm
            where wm.workspace_id = w.id
              and wm.user_id = current_user_id()
              and wm.is_active
          )
        )
      )
  );
$$;

create or replace function current_workspace_role(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select r.key
      from workspace_memberships wm
      join roles r on r.id = wm.role_id
      where wm.workspace_id = target_workspace_id
        and wm.user_id = current_user_id()
        and wm.is_active
      limit 1
    ),
    (
      select 'workspace_admin'
      from industry_workspaces w
      where w.id = target_workspace_id
        and is_org_owner(w.organization_id)
    )
  );
$$;

create or replace function is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select current_workspace_role(target_workspace_id) in ('workspace_admin', 'workspace_manager');
$$;

alter table industry_workspaces enable row level security;
alter table workspace_memberships enable row level security;

create policy industry_workspaces_select on industry_workspaces
  for select using (is_org_member(organization_id));
-- Creating/editing workspaces is an organization-level action (Settings
-- -> Industry Workspaces), gated on org ownership, not a workspace role
-- (there's no workspace to be a member of before it exists).
create policy industry_workspaces_write on industry_workspaces
  for all using (is_org_owner(organization_id)) with check (is_org_owner(organization_id));

create policy workspace_memberships_select on workspace_memberships
  for select using (is_workspace_member(workspace_id));
create policy workspace_memberships_write on workspace_memberships
  for all using (
    exists (select 1 from industry_workspaces w where w.id = workspace_id and is_org_owner(w.organization_id))
  )
  with check (
    exists (select 1 from industry_workspaces w where w.id = workspace_id and is_org_owner(w.organization_id))
  );

-- ---------------------------------------------------------------------
-- locations: ORGANIZATION-level physical/business locations, optionally
-- shared across one or more workspaces via workspace_locations.
-- ---------------------------------------------------------------------
create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_org_idx on locations(organization_id);

create trigger locations_set_updated_at
  before update on locations
  for each row execute function set_updated_at();

create table workspace_locations (
  workspace_id uuid not null references industry_workspaces(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, location_id)
);

alter table locations enable row level security;
alter table workspace_locations enable row level security;

create policy locations_select on locations for select using (is_org_member(organization_id));
create policy locations_write on locations for all
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy workspace_locations_select on workspace_locations
  for select using (is_workspace_member(workspace_id));
create policy workspace_locations_write on workspace_locations
  for all using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------
-- requirement_definitions: the CANONICAL, industry-agnostic catalog
-- ("CPR/BLS Certification") that lets two workspaces' requirements be
-- recognized as the same underlying thing without comparing display
-- names. Reference data -- no organization_id, no RLS.
-- ---------------------------------------------------------------------
create table requirement_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category credential_category not null default 'training',
  default_renewal_interval_value int,
  default_renewal_interval_unit renewal_interval_unit,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger requirement_definitions_set_updated_at
  before update on requirement_definitions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Template system: industry_definitions -> template_definitions ->
-- template_versions -> template_requirements/template_positions.
-- Reference data -- no organization_id, no RLS. Adopting a template
-- COPIES its requirements into an organization's own workspace_
-- requirements (see workspace_requirements below); nothing here is
-- referenced live by tenant data, so publishing a new template_version
-- never silently changes what an existing workspace enforces.
-- ---------------------------------------------------------------------
create type template_status as enum ('draft', 'published', 'retired');

create table template_definitions (
  id uuid primary key default gen_random_uuid(),
  industry_definition_id uuid not null references industry_definitions(id),
  key text not null,
  name text not null,
  description text,
  jurisdiction text, -- e.g. 'US-FL'; null = no specific jurisdiction
  organization_type text, -- e.g. 'group_home'; null = general
  status template_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (industry_definition_id, key)
);

create index template_definitions_industry_idx on template_definitions(industry_definition_id);

create trigger template_definitions_set_updated_at
  before update on template_definitions
  for each row execute function set_updated_at();

create table template_versions (
  id uuid primary key default gen_random_uuid(),
  template_definition_id uuid not null references template_definitions(id) on delete cascade,
  version_number int not null,
  effective_date date,
  -- Regulatory/authoritative citation for this version's requirements.
  -- Required before a version can be marked 'published' (enforced in
  -- application code, not a NOT NULL constraint, since drafts are saved
  -- before a source is finalized).
  source text,
  status template_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_definition_id, version_number)
);

create index template_versions_definition_idx on template_versions(template_definition_id);

create trigger template_versions_set_updated_at
  before update on template_versions
  for each row execute function set_updated_at();

-- Deferred FK: industry_workspaces.source_template_version_id was added
-- above, before this table existed to reference.
alter table industry_workspaces
  add constraint industry_workspaces_source_template_version_fk
  foreign key (source_template_version_id) references template_versions(id);

create table template_requirements (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references template_versions(id) on delete cascade,
  requirement_definition_id uuid references requirement_definitions(id),
  key text not null,
  name text not null,
  description text,
  category credential_category not null default 'training',
  renewal_interval_value int,
  renewal_interval_unit renewal_interval_unit,
  requires_document boolean not null default true,
  is_required_default boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (template_version_id, key)
);

create index template_requirements_version_idx on template_requirements(template_version_id);

create table template_positions (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references template_versions(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (template_version_id, key)
);

create index template_positions_version_idx on template_positions(template_version_id);

create table template_position_requirements (
  id uuid primary key default gen_random_uuid(),
  template_position_id uuid not null references template_positions(id) on delete cascade,
  template_requirement_id uuid not null references template_requirements(id) on delete cascade,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_position_id, template_requirement_id)
);

-- ---------------------------------------------------------------------
-- workspace_requirements: a WORKSPACE's own (possibly customized) copy
-- of a requirement -- either adopted from a template_requirement,
-- linked to a canonical requirement_definition, or fully custom (both
-- nullable). This is the workspace-scoped analogue of credential_types;
-- Phase 2 re-points position_requirements/employee_credentials at this
-- table instead and retires credential_types.
-- ---------------------------------------------------------------------
create table workspace_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references industry_workspaces(id) on delete cascade,
  canonical_requirement_definition_id uuid references requirement_definitions(id),
  source_template_requirement_id uuid references template_requirements(id),
  key text not null,
  name text not null,
  description text,
  category credential_category not null default 'training',
  renewal_interval_value int,
  renewal_interval_unit renewal_interval_unit,
  requires_document boolean not null default true,
  is_required_default boolean not null default true,
  warning_yellow_threshold_days int,
  warning_orange_threshold_days int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create index workspace_requirements_workspace_idx on workspace_requirements(workspace_id);
create index workspace_requirements_canonical_idx on workspace_requirements(canonical_requirement_definition_id);

create trigger workspace_requirements_set_updated_at
  before update on workspace_requirements
  for each row execute function set_updated_at();

alter table workspace_requirements enable row level security;

create policy workspace_requirements_select on workspace_requirements
  for select using (is_workspace_member(workspace_id));
create policy workspace_requirements_write on workspace_requirements
  for all using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------
-- employee_workspace_assignments / employee_position_assignments:
-- ONE employee identity (organization-scoped, unchanged) may belong to
-- multiple workspaces and hold multiple positions across them, instead
-- of today's single employees.position_id.
-- ---------------------------------------------------------------------
create table employee_workspace_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references industry_workspaces(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, employee_id)
);

create index employee_workspace_assignments_workspace_idx on employee_workspace_assignments(workspace_id);
create index employee_workspace_assignments_employee_idx on employee_workspace_assignments(employee_id);

create trigger employee_workspace_assignments_set_updated_at
  before update on employee_workspace_assignments
  for each row execute function set_updated_at();

create table employee_position_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_id uuid not null references industry_workspaces(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  is_primary boolean not null default false,
  assigned_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, employee_id, position_id)
);

create index employee_position_assignments_workspace_idx on employee_position_assignments(workspace_id);
create index employee_position_assignments_employee_idx on employee_position_assignments(employee_id);

create trigger employee_position_assignments_set_updated_at
  before update on employee_position_assignments
  for each row execute function set_updated_at();

alter table employee_workspace_assignments enable row level security;
alter table employee_position_assignments enable row level security;

create policy employee_workspace_assignments_select_admin on employee_workspace_assignments
  for select using (is_workspace_admin(workspace_id));
create policy employee_workspace_assignments_select_self on employee_workspace_assignments
  for select using (employee_id = current_employee_id(organization_id));
create policy employee_workspace_assignments_write on employee_workspace_assignments
  for all using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

create policy employee_position_assignments_select_admin on employee_position_assignments
  for select using (is_workspace_admin(workspace_id));
create policy employee_position_assignments_select_self on employee_position_assignments
  for select using (employee_id = current_employee_id(organization_id));
create policy employee_position_assignments_write on employee_position_assignments
  for all using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------
-- requirement_evidence_links: lets ONE piece of evidence
-- (employee_credentials row) satisfy MULTIPLE workspace_requirements,
-- but only when explicitly linked -- never by matching display names.
-- Phase 1 creates this table; the matching/auto-linking logic (by
-- shared canonical_requirement_definition_id) is Phase 4.
-- ---------------------------------------------------------------------
create table requirement_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workspace_requirement_id uuid not null references workspace_requirements(id) on delete cascade,
  employee_credential_id uuid not null references employee_credentials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_requirement_id, employee_credential_id)
);

create index requirement_evidence_links_requirement_idx on requirement_evidence_links(workspace_requirement_id);
create index requirement_evidence_links_credential_idx on requirement_evidence_links(employee_credential_id);

alter table requirement_evidence_links enable row level security;

create policy requirement_evidence_links_select on requirement_evidence_links
  for select using (
    exists (
      select 1 from workspace_requirements wr
      where wr.id = workspace_requirement_id and is_workspace_member(wr.workspace_id)
    )
  );
create policy requirement_evidence_links_write on requirement_evidence_links
  for all using (
    exists (
      select 1 from workspace_requirements wr
      where wr.id = workspace_requirement_id and is_workspace_admin(wr.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from workspace_requirements wr
      where wr.id = workspace_requirement_id and is_workspace_admin(wr.workspace_id)
    )
  );

-- ---------------------------------------------------------------------
-- template_update_decisions: audit trail for "Template Update Available
-- -> Accept/Apply Update or Defer/Review Later" (see docs/ARCHITECTURE.md).
-- Phase 1 creates the table; the update-detection/apply flow is Phase 6.
-- ---------------------------------------------------------------------
create type template_update_decision as enum ('applied', 'deferred');

create table template_update_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references industry_workspaces(id) on delete cascade,
  template_version_id uuid not null references template_versions(id),
  decision template_update_decision not null,
  decided_by uuid references users(id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index template_update_decisions_workspace_idx on template_update_decisions(workspace_id);

alter table template_update_decisions enable row level security;

create policy template_update_decisions_select on template_update_decisions
  for select using (is_workspace_member(workspace_id));
create policy template_update_decisions_write on template_update_decisions
  for insert with check (is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------
-- Additive workspace_id columns on existing organization-scoped tables.
-- Nullable and unused by existing RLS/queries for now -- backfilled by
-- application code (see lib/organizations.ts) for every NEW row going
-- forward, and by a one-off backfill for whatever existed before this
-- migration. Phase 2 makes these NOT NULL and cuts RLS over to them.
-- ---------------------------------------------------------------------
alter table positions add column workspace_id uuid references industry_workspaces(id);
alter table credential_types add column workspace_id uuid references industry_workspaces(id);
alter table position_requirements add column workspace_id uuid references industry_workspaces(id);
alter table employee_credentials add column workspace_id uuid references industry_workspaces(id);
alter table notification_rules add column workspace_id uuid references industry_workspaces(id);

create index positions_workspace_idx on positions(workspace_id);
create index credential_types_workspace_idx on credential_types(workspace_id);
create index position_requirements_workspace_idx on position_requirements(workspace_id);
create index employee_credentials_workspace_idx on employee_credentials(workspace_id);
create index notification_rules_workspace_idx on notification_rules(workspace_id);

-- ---------------------------------------------------------------------
-- Backfill: give every organization that exists as of this migration a
-- default Healthcare workspace (matching this deployment's initial
-- target market), an owner workspace membership, and repoint its
-- existing positions/credential_types/position_requirements/
-- employee_credentials/notification_rules at it. Safe to run
-- unconditionally -- this migration only ever runs once per database
-- (tracked in schema_migrations), and every column touched here was
-- just added as nullable above.
-- ---------------------------------------------------------------------
do $$
declare
  org record;
  healthcare_industry_id uuid;
  new_workspace_id uuid;
  workspace_admin_role_id uuid;
  owner_membership record;
begin
  select id into healthcare_industry_id from industry_definitions where key = 'healthcare';
  select id into workspace_admin_role_id from roles where key = 'workspace_admin';

  for org in select id, name from organizations loop
    insert into industry_workspaces (organization_id, industry_definition_id, name, slug, status)
    values (org.id, healthcare_industry_id, 'Healthcare', 'healthcare', 'active')
    returning id into new_workspace_id;

    for owner_membership in
      select ou.user_id
      from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.organization_id = org.id and r.key = 'owner' and ou.is_active
    loop
      insert into workspace_memberships (workspace_id, user_id, role_id)
      values (new_workspace_id, owner_membership.user_id, workspace_admin_role_id)
      on conflict (workspace_id, user_id) do nothing;
    end loop;

    update positions set workspace_id = new_workspace_id where organization_id = org.id;
    update credential_types set workspace_id = new_workspace_id where organization_id = org.id;
    update position_requirements set workspace_id = new_workspace_id where organization_id = org.id;
    update employee_credentials set workspace_id = new_workspace_id where organization_id = org.id;
    update notification_rules set workspace_id = new_workspace_id where organization_id = org.id;
  end loop;
end;
$$;
