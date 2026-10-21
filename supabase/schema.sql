-- Cahaba River Estates database
-- Run once in Supabase > SQL Editor > New query > paste > Run.
-- Every table is readable only by approved neighbors. No analytics, no tracking.

-- ---------- households ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  street text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select approved from profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

alter table profiles enable row level security;
create policy "see neighbors" on profiles for select
  using (id = auth.uid() or is_admin() or (approved and is_approved()));
create policy "sign up" on profiles for insert
  with check (id = auth.uid() and approved = false and is_admin = false);
create policy "admins approve" on profiles for update using (is_admin());
create policy "admins remove" on profiles for delete using (is_admin());

-- ---------- events ----------
create table public.events (
  id bigint generated always as identity primary key,
  title text not null,
  starts_at timestamptz not null,
  location text,
  details text,
  cap int check (cap is null or cap > 0),
  created_by uuid not null default auth.uid() references profiles on delete cascade,
  created_at timestamptz not null default now()
);
create table public.rsvps (
  id bigint generated always as identity primary key,
  event_id bigint not null references events on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  party int not null default 1 check (party between 1 and 20),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------- help board ----------
create table public.help_posts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('need','offer')),
  title text not null,
  details text,
  status text not null default 'open' check (status in ('open','done')),
  created_by uuid not null default auth.uid() references profiles on delete cascade,
  created_at timestamptz not null default now()
);
create table public.help_replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references help_posts on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- ---------- recommendations ----------
create table public.recs (
  id bigint generated always as identity primary key,
  category text not null,
  name text not null,
  phone text,
  website text,
  note text,
  created_by uuid not null default auth.uid() references profiles on delete cascade,
  created_at timestamptz not null default now()
);
create table public.rec_votes (
  rec_id bigint not null references recs on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (rec_id, user_id)
);

-- ---------- care calendar ----------
create table public.care_pages (
  id bigint generated always as identity primary key,
  title text not null,
  for_whom text,
  details text,
  created_by uuid not null default auth.uid() references profiles on delete cascade,
  created_at timestamptz not null default now()
);
create table public.care_slots (
  id bigint generated always as identity primary key,
  page_id bigint not null references care_pages on delete cascade,
  day date not null,
  need text not null,
  claimed_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- news ----------
create table public.news (
  id bigint generated always as identity primary key,
  title text not null,
  body text,
  created_by uuid not null default auth.uid() references profiles on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- history wiki ----------
create table public.wiki_pages (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  body text not null default '',
  updated_by uuid default auth.uid() references profiles on delete set null,
  updated_at timestamptz not null default now()
);
create table public.wiki_revisions (
  id bigint generated always as identity primary key,
  page_id bigint not null references wiki_pages on delete cascade,
  title text,
  body text,
  edited_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
-- Every edit keeps the previous version, so nothing is ever lost.
create or replace function public.keep_revision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into wiki_revisions (page_id, title, body, edited_by, created_at)
  values (old.id, old.title, old.body, old.updated_by, old.updated_at);
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger wiki_keep_revision before update on wiki_pages
  for each row execute function keep_revision();

-- ---------- access rules ----------
-- Approved neighbors can read everything and add their own items.
-- People can change or delete their own items. Admins can change anything.
do $$
declare t text; owner text;
begin
  foreach t in array array['events','help_posts','recs','care_pages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select using (is_approved())', t);
    execute format('create policy "add" on %I for insert with check (is_approved() and created_by = auth.uid())', t);
    execute format('create policy "edit" on %I for update using (created_by = auth.uid() or is_admin())', t);
    execute format('create policy "remove" on %I for delete using (created_by = auth.uid() or is_admin())', t);
  end loop;
  foreach t in array array['rsvps','help_replies','rec_votes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select using (is_approved())', t);
    execute format('create policy "add" on %I for insert with check (is_approved() and user_id = auth.uid())', t);
    execute format('create policy "edit" on %I for update using (user_id = auth.uid())', t);
    execute format('create policy "remove" on %I for delete using (user_id = auth.uid() or is_admin())', t);
  end loop;
end $$;

-- Care slots: anyone approved can claim an open slot or release their own.
alter table care_slots enable row level security;
create policy "read" on care_slots for select using (is_approved());
create policy "add" on care_slots for insert with check (
  is_approved() and exists (select 1 from care_pages p where p.id = page_id and (p.created_by = auth.uid() or is_admin())));
create policy "claim" on care_slots for update
  using (is_approved() and (claimed_by is null or claimed_by = auth.uid() or is_admin()))
  with check (claimed_by is null or claimed_by = auth.uid() or is_admin());
create policy "remove" on care_slots for delete using (
  exists (select 1 from care_pages p where p.id = page_id and (p.created_by = auth.uid() or is_admin())));

-- News: written by admins (board / editors), read by neighbors.
alter table news enable row level security;
create policy "read" on news for select using (is_approved());
create policy "write" on news for all using (is_admin()) with check (is_admin());

-- Wiki: any approved neighbor can add or edit. Only admins delete.
alter table wiki_pages enable row level security;
create policy "read" on wiki_pages for select using (is_approved());
create policy "add" on wiki_pages for insert with check (is_approved());
create policy "edit" on wiki_pages for update using (is_approved());
create policy "remove" on wiki_pages for delete using (is_admin());
alter table wiki_revisions enable row level security;
create policy "read" on wiki_revisions for select using (is_approved());

-- Starter history page
insert into wiki_pages (slug, title, body, updated_by) values ('the-old-lodge', 'The Old Lodge',
'The house at 1122 Cahaba River Estates was built in 1928 on about 8 acres along the river. It began as a summer home and hunting retreat, and longtime neighbors remember it as a lodge where people hunted, gathered, and, by most accounts, gambled.

What do you know? Add names, dates, and stories here.', null);

-- AFTER you sign in on the site the first time, make yourself the admin:
--   update profiles set approved = true, is_admin = true where name = 'YOUR NAME HERE';
