-- Renewal workflow as a single atomic operation (see docs/ARCHITECTURE.md §7):
-- archive the current active credential record, insert the new one, link
-- them, and write the audit log entry -- all or nothing. Runs as
-- SECURITY INVOKER (the default) so the caller still needs the
-- employee_credentials write policy (is_org_admin) to succeed; RLS is not
-- bypassed here.
create or replace function renew_employee_credential(
  p_employee_id uuid,
  p_credential_type_id uuid,
  p_completion_date date,
  p_issue_date date,
  p_expiration_date date,
  p_certificate_number text,
  p_issuing_organization text,
  p_notes text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_org_id uuid;
  v_old_id uuid;
  v_new_id uuid;
begin
  select organization_id into v_org_id from employees where id = p_employee_id;
  if v_org_id is null then
    raise exception 'Employee % not found', p_employee_id;
  end if;

  select id into v_old_id
  from employee_credentials
  where employee_id = p_employee_id
    and credential_type_id = p_credential_type_id
    and status = 'active';

  if v_old_id is not null then
    update employee_credentials
      set status = 'archived', updated_by = p_actor_user_id
      where id = v_old_id;
  end if;

  insert into employee_credentials (
    organization_id, employee_id, credential_type_id, status,
    completion_date, issue_date, expiration_date,
    certificate_number, issuing_organization, notes,
    created_by, updated_by
  ) values (
    v_org_id, p_employee_id, p_credential_type_id, 'active',
    p_completion_date, p_issue_date, p_expiration_date,
    nullif(p_certificate_number, ''), nullif(p_issuing_organization, ''), nullif(p_notes, ''),
    p_actor_user_id, p_actor_user_id
  )
  returning id into v_new_id;

  if v_old_id is not null then
    update employee_credentials set superseded_by = v_new_id where id = v_old_id;
  end if;

  insert into audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id,
    affected_employee_id, previous_value, new_value
  ) values (
    v_org_id, p_actor_user_id, 'credential.renewed', 'employee_credential', v_new_id,
    p_employee_id,
    case when v_old_id is not null then jsonb_build_object('id', v_old_id) else null end,
    jsonb_build_object(
      'id', v_new_id,
      'completion_date', p_completion_date,
      'expiration_date', p_expiration_date
    )
  );

  return v_new_id;
end;
$$;
