-- Private document storage: one bucket, path convention
--   credential-documents/{organization_id}/{employee_id}/{credential_id}/{filename}
-- Objects are never public; all reads go through signed URLs issued
-- server-side after an RLS-backed permission check.

insert into storage.buckets (id, name, public)
values ('credential-documents', 'credential-documents', false)
on conflict (id) do nothing;

-- Path segment 1 = organization_id, segment 2 = employee_id.
create or replace function storage_path_org_id(object_name text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(object_name, '/'))[1]::uuid;
$$;

create policy credential_documents_storage_select_admin
  on storage.objects for select
  using (
    bucket_id = 'credential-documents'
    and is_org_admin(storage_path_org_id(name))
  );

create policy credential_documents_storage_select_self
  on storage.objects for select
  using (
    bucket_id = 'credential-documents'
    and (string_to_array(name, '/'))[2]::uuid = current_employee_id(storage_path_org_id(name))
  );

create policy credential_documents_storage_insert_admin
  on storage.objects for insert
  with check (
    bucket_id = 'credential-documents'
    and is_org_admin(storage_path_org_id(name))
  );

create policy credential_documents_storage_insert_self
  on storage.objects for insert
  with check (
    bucket_id = 'credential-documents'
    and (string_to_array(name, '/'))[2]::uuid = current_employee_id(storage_path_org_id(name))
  );

create policy credential_documents_storage_delete_admin
  on storage.objects for delete
  using (
    bucket_id = 'credential-documents'
    and is_org_admin(storage_path_org_id(name))
  );

-- Employee profile photos: small, still private (never publicly guessable).
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', false)
on conflict (id) do nothing;

create policy employee_photos_storage_select
  on storage.objects for select
  using (
    bucket_id = 'employee-photos'
    and is_org_member(storage_path_org_id(name))
  );

create policy employee_photos_storage_write_admin
  on storage.objects for all
  using (
    bucket_id = 'employee-photos'
    and is_org_admin(storage_path_org_id(name))
  )
  with check (
    bucket_id = 'employee-photos'
    and is_org_admin(storage_path_org_id(name))
  );
