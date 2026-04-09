-- Create storage bucket for knowledge base documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

-- Allow authenticated users to upload files to their organization's folder
create policy "Users can upload documents to their org"
on storage.objects for insert
with check (
  bucket_id = 'documents' and
  auth.role() = 'authenticated' and
  (storage.foldername(name))[1] in (
    select organization_id::text from organization_members
    where user_id = auth.uid()
  )
);

-- Allow users to read documents from their organization
create policy "Users can read documents from their org"
on storage.objects for select
using (
  bucket_id = 'documents' and
  (storage.foldername(name))[1] in (
    select organization_id::text from organization_members
    where user_id = auth.uid()
  )
);

-- Allow admins to delete documents from their organization
create policy "Admins can delete documents from their org"
on storage.objects for delete
using (
  bucket_id = 'documents' and
  (storage.foldername(name))[1] in (
    select organization_id::text from organization_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  )
);
