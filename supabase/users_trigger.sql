-- Auto-create public.users rows for each auth.users row
-- Run this in Supabase SQL editor with service role privileges.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, created_at)
  values (new.id, new.email, coalesce(split_part(new.email, '@', 1), 'User'), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Recommended RLS policies (if not already present)
alter table public.users enable row level security;

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
for update using (auth.uid() = id);

drop policy if exists "Users can insert self" on public.users;
create policy "Users can insert self" on public.users
for insert with check (auth.uid() = id);
