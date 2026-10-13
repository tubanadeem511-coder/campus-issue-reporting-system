-- CampusFix account-based schema. Apply to a fresh Supabase project.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create function public.campusfix_profile_on_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), 'student');
  return new;
end; $$;
create trigger campusfix_auth_user_created after insert on auth.users
for each row execute function public.campusfix_profile_on_signup();

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique default ('CF-' || upper(substr(encode(gen_random_bytes(8),'hex'),1,12))),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in ('Computer','Projector','Fan','Light','Wi-Fi')),
  building text not null check (char_length(building) between 1 and 120),
  room text not null check (char_length(room) between 1 and 80),
  description text not null check (char_length(description) between 10 and 3000),
  image_path text,
  status text not null default 'Pending' check (status in ('Pending','In Progress','Resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index complaints_owner_created_idx on public.complaints(owner_id, created_at desc);
create index complaints_status_created_idx on public.complaints(status, created_at desc);
create index complaints_category_created_idx on public.complaints(category, created_at desc);
create index complaints_building_idx on public.complaints(building);

create table public.complaint_status_history (
  id bigint generated always as identity primary key,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  old_status text check (old_status is null or old_status in ('Pending','In Progress','Resolved')),
  new_status text not null check (new_status in ('Pending','In Progress','Resolved')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index complaint_history_complaint_idx on public.complaint_status_history(complaint_id, changed_at desc);

create function public.campusfix_status_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.complaint_status_history(complaint_id,old_status,new_status,changed_by)
    values(new.id,old.status,new.status,auth.uid());
    new.updated_at = now();
  end if;
  return new;
end; $$;
create trigger complaints_status_history before update on public.complaints
for each row execute function public.campusfix_status_history();

create function public.campusfix_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_status_history enable row level security;
create policy "profiles_select_self_or_admin" on public.profiles for select to authenticated using (id = auth.uid() or public.campusfix_is_admin());
create policy "profiles_update_self_name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'student');
create policy "complaints_read_owner_or_admin" on public.complaints for select to authenticated using (owner_id = auth.uid() or public.campusfix_is_admin());
create policy "complaints_insert_self" on public.complaints for insert to authenticated with check (owner_id = auth.uid() and status = 'Pending');
create policy "complaints_update_admin" on public.complaints for update to authenticated using (public.campusfix_is_admin()) with check (public.campusfix_is_admin());
create policy "history_read_owner_or_admin" on public.complaint_status_history for select to authenticated using (
  public.campusfix_is_admin() or exists(select 1 from public.complaints c where c.id = complaint_id and c.owner_id = auth.uid())
);
revoke all on public.profiles, public.complaints, public.complaint_status_history from anon;
grant select, update on public.profiles to authenticated;
grant select, insert on public.complaints to authenticated;
grant update (status) on public.complaints to authenticated;
grant select on public.complaint_status_history to authenticated;
grant usage, select on sequence public.complaint_status_history_id_seq to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('complaint-images','complaint-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy "complaint_images_owner_upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'complaint-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "complaint_images_owner_or_admin_read" on storage.objects for select to authenticated using (
  bucket_id = 'complaint-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.campusfix_is_admin())
);
create policy "complaint_images_owner_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'complaint-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.campusfix_is_admin())
);

-- First admin: create the user through Supabase Auth, then execute in SQL Editor:
-- update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
