-- Local development seed data ONLY. Never run against a production project.
-- Creates one demo organization with a demo Owner login and a set of
-- fictional employees deliberately covering every compliance status
-- (green/yellow/orange/red/gray), a terminated employee (excluded from
-- active alerts), and a new hire (missing checklist).
--
-- Demo login (local Supabase auth): demo.owner@example.com / DemoPass123!

create extension if not exists "pgcrypto";

do $$
declare
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_owner_user_id uuid := '00000000-0000-0000-0000-0000000000aa';
  v_owner_role_id uuid;

  v_dept_home_care uuid;
  v_dept_admin uuid;

  v_pos_direct_care uuid;
  v_pos_office_admin uuid;

  v_ct_cpr uuid;
  v_ct_first_aid uuid;
  v_ct_hipaa uuid;
  v_ct_zero_tolerance uuid;
  v_ct_hiv_aids uuid;
  v_ct_core_competencies uuid;
  v_ct_moral_character uuid;
  v_ct_local_bg uuid;
  v_ct_fdle_bg uuid;

  v_emp_jane uuid;
  v_emp_marcus uuid;
  v_emp_priya uuid;
  v_emp_david uuid;
  v_emp_sarah uuid;
  v_emp_emily uuid;
  v_emp_robert uuid;
  v_emp_alicia uuid;
begin
  -- ---------------------------------------------------------------
  -- Organization + demo owner login
  -- ---------------------------------------------------------------
  insert into organizations (id, name, slug)
  values (v_org_id, 'Greenwood Home Health (Demo)', 'greenwood-demo')
  on conflict (id) do nothing;

  insert into organization_settings (organization_id)
  values (v_org_id)
  on conflict (organization_id) do nothing;

  select id into v_owner_role_id from roles where key = 'owner';

  if not exists (select 1 from auth.users where id = v_owner_user_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_owner_user_id, 'authenticated', 'authenticated',
      'demo.owner@example.com', crypt('DemoPass123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Owner"}',
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_owner_user_id,
      jsonb_build_object('sub', v_owner_user_id::text, 'email', 'demo.owner@example.com'),
      'email', v_owner_user_id::text, now(), now(), now()
    );
  end if;

  insert into organization_users (organization_id, user_id, role_id)
  values (v_org_id, v_owner_user_id, v_owner_role_id)
  on conflict (organization_id, user_id) do nothing;

  -- ---------------------------------------------------------------
  -- Departments / positions
  -- ---------------------------------------------------------------
  insert into departments (organization_id, name) values (v_org_id, 'Home Care Services')
    returning id into v_dept_home_care;
  insert into departments (organization_id, name) values (v_org_id, 'Administration')
    returning id into v_dept_admin;

  insert into positions (organization_id, name, description)
    values (v_org_id, 'Direct Care Worker', 'Provides direct in-home care to clients.')
    returning id into v_pos_direct_care;
  insert into positions (organization_id, name, description)
    values (v_org_id, 'Office Administrator', 'Administrative and scheduling support.')
    returning id into v_pos_office_admin;

  -- ---------------------------------------------------------------
  -- Credential types (the 9 initial required items)
  -- ---------------------------------------------------------------
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'cpr', 'CPR', 'training', 2, 'years', true, 1) returning id into v_ct_cpr;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'first_aid', 'First Aid', 'training', 2, 'years', true, 2) returning id into v_ct_first_aid;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'hipaa', 'HIPAA', 'training', 1, 'years', true, 3) returning id into v_ct_hipaa;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'zero_tolerance', 'Zero Tolerance', 'training', 3, 'years', true, 4) returning id into v_ct_zero_tolerance;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'hiv_aids_101', 'HIV/AIDS 101', 'training', 2, 'years', true, 5) returning id into v_ct_hiv_aids;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'direct_care_core_competencies', 'Direct Care Core Competencies', 'training', 1, 'years', true, 6) returning id into v_ct_core_competencies;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'letter_of_moral_character', 'Letter of Moral Character', 'document', null, null, true, 7) returning id into v_ct_moral_character;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'local_background_check', 'Local Background Check', 'background_check', 5, 'years', true, 8) returning id into v_ct_local_bg;
  insert into credential_types (organization_id, key, name, category, renewal_interval_value, renewal_interval_unit, requires_document, sort_order)
    values (v_org_id, 'fdle_background_check', 'FDLE Background Check', 'background_check', 5, 'years', true, 9) returning id into v_ct_fdle_bg;

  -- ---------------------------------------------------------------
  -- Position requirements
  -- ---------------------------------------------------------------
  insert into position_requirements (organization_id, position_id, credential_type_id)
  select v_org_id, v_pos_direct_care, ct.id from credential_types ct where ct.organization_id = v_org_id;

  insert into position_requirements (organization_id, position_id, credential_type_id)
  values
    (v_org_id, v_pos_office_admin, v_ct_hipaa),
    (v_org_id, v_pos_office_admin, v_ct_local_bg),
    (v_org_id, v_pos_office_admin, v_ct_fdle_bg);

  -- ---------------------------------------------------------------
  -- Employees
  -- ---------------------------------------------------------------
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1001', 'Jane', 'Smith', '2024-01-10', v_pos_direct_care, v_dept_home_care, 'active', 'jane.smith@example.com', '555-0101', v_owner_user_id)
    returning id into v_emp_jane;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1002', 'Marcus', 'Lee', '2024-03-05', v_pos_direct_care, v_dept_home_care, 'active', 'marcus.lee@example.com', '555-0102', v_owner_user_id)
    returning id into v_emp_marcus;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1003', 'Priya', 'Patel', '2023-11-20', v_pos_direct_care, v_dept_home_care, 'active', 'priya.patel@example.com', '555-0103', v_owner_user_id)
    returning id into v_emp_priya;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1004', 'David', 'Nguyen', '2023-08-14', v_pos_direct_care, v_dept_home_care, 'active', 'david.nguyen@example.com', '555-0104', v_owner_user_id)
    returning id into v_emp_david;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1005', 'Sarah', 'Johnson', '2023-05-02', v_pos_direct_care, v_dept_home_care, 'active', 'sarah.johnson@example.com', '555-0105', v_owner_user_id)
    returning id into v_emp_sarah;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1006', 'Emily', 'Davis', '2022-09-19', v_pos_office_admin, v_dept_admin, 'active', 'emily.davis@example.com', '555-0106', v_owner_user_id)
    returning id into v_emp_emily;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1007', 'Robert', 'Chen', '2021-02-01', v_pos_direct_care, v_dept_home_care, 'terminated', 'robert.chen@example.com', '555-0107', v_owner_user_id)
    returning id into v_emp_robert;
  insert into employees (organization_id, employee_number, first_name, last_name, date_of_hire, position_id, department_id, employment_status, email, phone, created_by)
    values (v_org_id, 'EMP-1008', 'Alicia', 'Gomez', '2026-09-13', v_pos_direct_care, v_dept_home_care, 'active', 'alicia.gomez@example.com', '555-0108', v_owner_user_id)
    returning id into v_emp_alicia;

  -- ---------------------------------------------------------------
  -- Jane Smith: fully compliant (GREEN across the board)
  -- ---------------------------------------------------------------
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_jane, v_ct_cpr, '2025-06-01', '2027-06-01', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_first_aid, '2025-06-01', '2027-06-01', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_hipaa, '2026-03-01', '2027-03-01', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_zero_tolerance, '2024-01-15', '2027-01-15', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_hiv_aids, '2025-05-01', '2027-05-01', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_core_competencies, '2026-04-01', '2027-04-01', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_moral_character, '2024-01-05', null, v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_local_bg, '2024-01-08', '2029-01-08', v_owner_user_id),
    (v_org_id, v_emp_jane, v_ct_fdle_bg, '2024-01-08', '2029-01-08', v_owner_user_id);

  -- Marcus Lee: HIPAA expiring in ~75 days (YELLOW), rest current
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_marcus, v_ct_cpr, '2025-04-01', '2027-04-01', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_first_aid, '2025-04-01', '2027-04-01', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_hipaa, '2025-12-02', '2026-12-02', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_zero_tolerance, '2024-03-10', '2027-03-10', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_hiv_aids, '2025-06-01', '2027-06-01', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_core_competencies, '2026-02-01', '2027-02-01', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_moral_character, '2024-03-06', null, v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_local_bg, '2024-03-08', '2029-03-08', v_owner_user_id),
    (v_org_id, v_emp_marcus, v_ct_fdle_bg, '2024-03-08', '2029-03-08', v_owner_user_id);

  -- Priya Patel: CPR expiring in 30 days (ORANGE), rest current
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_priya, v_ct_cpr, '2024-10-18', '2026-10-18', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_first_aid, '2024-10-18', '2026-10-18', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_hipaa, '2026-01-15', '2027-01-15', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_zero_tolerance, '2023-11-25', '2026-11-25', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_hiv_aids, '2025-07-01', '2027-07-01', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_core_competencies, '2026-01-01', '2027-01-01', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_moral_character, '2023-11-22', null, v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_local_bg, '2023-11-25', '2028-11-25', v_owner_user_id),
    (v_org_id, v_emp_priya, v_ct_fdle_bg, '2023-11-25', '2028-11-25', v_owner_user_id);

  -- David Nguyen: HIPAA expired 10 days ago (RED / non-compliant), rest current
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_david, v_ct_cpr, '2025-01-10', '2027-01-10', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_first_aid, '2025-01-10', '2027-01-10', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_hipaa, '2025-09-08', '2026-09-08', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_zero_tolerance, '2023-08-20', '2026-08-20', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_hiv_aids, '2025-02-01', '2027-02-01', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_core_competencies, '2026-01-10', '2027-01-10', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_moral_character, '2023-08-16', null, v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_local_bg, '2023-08-18', '2028-08-18', v_owner_user_id),
    (v_org_id, v_emp_david, v_ct_fdle_bg, '2023-08-18', '2028-08-18', v_owner_user_id);

  -- Sarah Johnson: Direct Care Core Competencies never completed (GRAY / missing documentation), rest current
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_sarah, v_ct_cpr, '2025-03-01', '2027-03-01', v_owner_user_id),
    (v_org_id, v_emp_sarah, v_ct_first_aid, '2025-03-01', '2027-03-01', v_owner_user_id),
    (v_org_id, v_emp_sarah, v_ct_hipaa, '2026-01-05', '2027-01-05', v_owner_user_id),
    (v_org_id, v_emp_sarah, v_ct_zero_tolerance, '2023-05-10', '2026-05-10', v_owner_user_id),
    (v_org_id, v_emp_sarah, v_ct_hiv_aids, '2025-04-01', '2027-04-01', v_owner_user_id),
    -- direct_care_core_competencies intentionally omitted: MISSING
    (v_org_id, v_emp_sarah, v_ct_moral_character, '2023-04-28', null, v_owner_user_id),
    (v_org_id, v_emp_sarah, v_ct_local_bg, '2023-05-01', '2028-05-01', v_owner_user_id),
    (v_org_id, v_emp_sarah, v_ct_fdle_bg, '2023-05-01', '2028-05-01', v_owner_user_id);

  -- Emily Davis: Office Administrator, fully compliant with her (smaller) requirement set
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_emily, v_ct_hipaa, '2026-02-01', '2027-02-01', v_owner_user_id),
    (v_org_id, v_emp_emily, v_ct_local_bg, '2022-09-15', '2027-09-15', v_owner_user_id),
    (v_org_id, v_emp_emily, v_ct_fdle_bg, '2022-09-15', '2027-09-15', v_owner_user_id);

  -- Robert Chen (terminated): has an old expired CPR, but terminated employees are
  -- excluded from active compliance alerts by default -- historical record only.
  insert into employee_credentials (organization_id, employee_id, credential_type_id, completion_date, expiration_date, created_by) values
    (v_org_id, v_emp_robert, v_ct_cpr, '2021-02-05', '2023-02-05', v_owner_user_id);

  -- Alicia Gomez: brand-new hire, nothing entered yet -- demonstrates the
  -- new-hire missing-requirements checklist (all required credentials GRAY).
  -- No employee_credentials rows inserted intentionally.

end $$;
