-- Employee Credential, Training & Compliance Management Platform
-- Phase 1: core schema, multi-tenant isolation, RLS.
--
-- Conventions:
--   * every business table has organization_id, enforced via RLS
--   * uuid primary keys (gen_random_uuid())
--   * created_at/updated_at timestamptz, updated via trigger
--   * completion/issue/expiration dates are `date` (calendar dates, not
--     instants) so renewal math never drifts across timezones

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create table organization_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  -- compliance color thresholds, in days remaining until expiration
  compliance_yellow_threshold_days int not null default 90,
  compliance_orange_threshold_days int not null default 60,
  -- default notification schedule (days before expiration; 0 = day of)
  notify_schedule_days int[] not null default array[90, 60, 30, 14, 7, 0],
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_settings_set_updated_at
  before update on organization_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- roles (table, not enum, so more can be added without a migration)
-- ---------------------------------------------------------------------
create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

insert into roles (key, name, description, is_system) values
  ('owner', 'Owner / Administrator', 'Full access to all organization data and settings.', true),
  ('office_manager', 'Office Manager', 'Manages employees, credentials, documents, and reports.', true),
  ('employee', 'Employee', 'Self-service access to own profile and credentials.', true);

-- ---------------------------------------------------------------------
-- organization_users: membership + role + optional link to an employee
-- record (used when an Employee-role user logs in to self-service)
-- ---------------------------------------------------------------------
create table organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id),
  employee_id uuid, -- fk added after employees table is created
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_users_org_idx on organization_users(organization_id);
create index organization_users_user_idx on organization_users(user_id);

create trigger organization_users_set_updated_at
  before update on organization_users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS helper functions (security definer: bypass RLS internally so they
-- can be used inside policies without recursion)
-- ---------------------------------------------------------------------
create or replace function is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from organization_users ou
    where ou.organization_id = target_org_id
      and ou.user_id = auth.uid()
      and ou.is_active
  );
$$;

create or replace function current_org_role(target_org_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select r.key
  from organization_users ou
  join roles r on r.id = ou.role_id
  where ou.organization_id = target_org_id
    and ou.user_id = auth.uid()
    and ou.is_active
  limit 1;
$$;

create or replace function is_org_admin(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select current_org_role(target_org_id) in ('owner', 'office_manager');
$$;

create or replace function is_org_owner(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select current_org_role(target_org_id) = 'owner';
$$;

create or replace function current_employee_id(target_org_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select ou.employee_id
  from organization_users ou
  where ou.organization_id = target_org_id
    and ou.user_id = auth.uid()
    and ou.is_active
  limit 1;
$$;

alter table organizations enable row level security;
alter table organization_settings enable row level security;
alter table organization_users enable row level security;

create policy organizations_select on organizations
  for select using (is_org_member(id));
create policy organizations_update on organizations
  for update using (is_org_owner(id));
-- INSERT for organizations happens via the signup Route Handler using the
-- service role key (a brand-new user has no membership yet to check).

create policy organization_settings_select on organization_settings
  for select using (is_org_member(organization_id));
create policy organization_settings_update on organization_settings
  for update using (is_org_owner(organization_id));

create policy organization_users_select on organization_users
  for select using (is_org_member(organization_id));
create policy organization_users_admin_write on organization_users
  for all using (is_org_owner(organization_id))
  with check (is_org_owner(organization_id));

-- ---------------------------------------------------------------------
-- departments / positions
-- ---------------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create trigger departments_set_updated_at
  before update on departments
  for each row execute function set_updated_at();

create table positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create trigger positions_set_updated_at
  before update on positions
  for each row execute function set_updated_at();

alter table departments enable row level security;
alter table positions enable row level security;

create policy departments_select on departments for select using (is_org_member(organization_id));
create policy departments_write on departments for all
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy positions_select on positions for select using (is_org_member(organization_id));
create policy positions_write on positions for all
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- ---------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------
create type employment_status as enum ('active', 'leave', 'inactive', 'terminated');

create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_number text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  preferred_name text,
  date_of_hire date not null,
  position_id uuid references positions(id),
  department_id uuid references departments(id),
  supervisor_id uuid references employees(id),
  employment_status employment_status not null default 'active',
  phone text,
  email text,
  photo_url text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number)
);

create index employees_org_idx on employees(organization_id);
create index employees_org_status_idx on employees(organization_id, employment_status);
create index employees_name_idx on employees(organization_id, last_name, first_name);

create trigger employees_set_updated_at
  before update on employees
  for each row execute function set_updated_at();

alter table organization_users
  add constraint organization_users_employee_fk
  foreign key (employee_id) references employees(id) on delete set null;

alter table employees enable row level security;

create policy employees_select_admin on employees
  for select using (is_org_admin(organization_id));
create policy employees_select_self on employees
  for select using (id = current_employee_id(organization_id));
create policy employees_write_admin on employees
  for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- ---------------------------------------------------------------------
-- credential_types (configurable catalog)
-- ---------------------------------------------------------------------
create type credential_category as enum ('training', 'background_check', 'document', 'other');
create type renewal_interval_unit as enum ('days', 'months', 'years');

create table credential_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  category credential_category not null default 'training',
  renewal_interval_value int,
  renewal_interval_unit renewal_interval_unit,
  requires_document boolean not null default true,
  is_required_default boolean not null default true,
  warning_yellow_threshold_days int, -- null = use org default
  warning_orange_threshold_days int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index credential_types_org_idx on credential_types(organization_id);

create trigger credential_types_set_updated_at
  before update on credential_types
  for each row execute function set_updated_at();

alter table credential_types enable row level security;

create policy credential_types_select on credential_types
  for select using (is_org_member(organization_id));
create policy credential_types_write on credential_types
  for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- ---------------------------------------------------------------------
-- position_requirements
-- ---------------------------------------------------------------------
create table position_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  credential_type_id uuid not null references credential_types(id) on delete cascade,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (position_id, credential_type_id)
);

create index position_requirements_org_idx on position_requirements(organization_id);
create index position_requirements_position_idx on position_requirements(position_id);

create trigger position_requirements_set_updated_at
  before update on position_requirements
  for each row execute function set_updated_at();

alter table position_requirements enable row level security;

create policy position_requirements_select on position_requirements
  for select using (is_org_member(organization_id));
create policy position_requirements_write on position_requirements
  for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- ---------------------------------------------------------------------
-- employee_credentials (versioned: renewals archive, never overwrite)
-- ---------------------------------------------------------------------
create type employee_credential_status as enum ('active', 'archived');

create table employee_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  credential_type_id uuid not null references credential_types(id),
  status employee_credential_status not null default 'active',
  completion_date date,
  issue_date date,
  expiration_date date,
  certificate_number text,
  issuing_organization text,
  notes text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  expiration_override boolean not null default false,
  expiration_override_reason text,
  superseded_by uuid references employee_credentials(id),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employee_credentials_org_idx on employee_credentials(organization_id);
create index employee_credentials_employee_idx on employee_credentials(employee_id);
create index employee_credentials_type_idx on employee_credentials(credential_type_id);
-- at most one active record per employee/credential type
create unique index employee_credentials_one_active
  on employee_credentials(employee_id, credential_type_id)
  where (status = 'active');

create trigger employee_credentials_set_updated_at
  before update on employee_credentials
  for each row execute function set_updated_at();

alter table employee_credentials enable row level security;

create policy employee_credentials_select_admin on employee_credentials
  for select using (is_org_admin(organization_id));
create policy employee_credentials_select_self on employee_credentials
  for select using (employee_id = current_employee_id(organization_id));
create policy employee_credentials_write_admin on employee_credentials
  for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- ---------------------------------------------------------------------
-- credential_documents (version history)
-- ---------------------------------------------------------------------
create table credential_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_credential_id uuid not null references employee_credentials(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  is_current boolean not null default true,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index credential_documents_org_idx on credential_documents(organization_id);
create index credential_documents_credential_idx on credential_documents(employee_credential_id);

alter table credential_documents enable row level security;

create policy credential_documents_select_admin on credential_documents
  for select using (is_org_admin(organization_id));
create policy credential_documents_select_self on credential_documents
  for select using (
    exists (
      select 1 from employee_credentials ec
      where ec.id = employee_credential_id
        and ec.employee_id = current_employee_id(organization_id)
    )
  );
create policy credential_documents_write_admin on credential_documents
  for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
-- employees may insert their own documents when a document was requested of them
create policy credential_documents_insert_self on credential_documents
  for insert with check (
    exists (
      select 1 from employee_credentials ec
      where ec.id = employee_credential_id
        and ec.employee_id = current_employee_id(organization_id)
    )
  );

-- ---------------------------------------------------------------------
-- notification_rules
-- ---------------------------------------------------------------------
create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  credential_type_id uuid references credential_types(id) on delete cascade, -- null = global default
  days_before int[] not null default array[90, 60, 30, 14, 7, 0],
  notify_roles text[] not null default array['owner', 'office_manager'],
  notify_employee boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_rules_org_idx on notification_rules(organization_id);

create trigger notification_rules_set_updated_at
  before update on notification_rules
  for each row execute function set_updated_at();

alter table notification_rules enable row level security;

create policy notification_rules_select on notification_rules
  for select using (is_org_member(organization_id));
create policy notification_rules_write on notification_rules
  for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- ---------------------------------------------------------------------
-- notifications (generated instances)
-- ---------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  employee_credential_id uuid references employee_credentials(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  severity text not null default 'info', -- info | warning | urgent | critical
  channel text[] not null default array['in_app'],
  is_read boolean not null default false,
  dedupe_key text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_org_idx on notifications(organization_id);
create index notifications_recipient_idx on notifications(recipient_user_id, is_read);
create unique index notifications_dedupe_idx
  on notifications(organization_id, dedupe_key)
  where (dedupe_key is not null);

alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select using (recipient_user_id = auth.uid());
create policy notifications_update_own on notifications
  for update using (recipient_user_id = auth.uid());
-- inserts happen via the service role from the notification job / server actions

-- ---------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  affected_employee_id uuid references employees(id),
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_idx on audit_logs(organization_id, created_at desc);
create index audit_logs_employee_idx on audit_logs(affected_employee_id);

alter table audit_logs enable row level security;

create policy audit_logs_select on audit_logs
  for select using (is_org_owner(organization_id));
create policy audit_logs_insert on audit_logs
  for insert with check (is_org_member(organization_id));
-- no update/update policy and no delete policy: append-only for every role,
-- service-role key bypasses RLS entirely for the background job's own writes.
