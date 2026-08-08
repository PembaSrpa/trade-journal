insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do update set public = false;

create policy "screenshots_insert_own_folder"
on storage.objects for insert
with check (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "screenshots_read_own_folder"
on storage.objects for select
using (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "screenshots_delete_own_folder"
on storage.objects for delete
using (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);
