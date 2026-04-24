-- AI 일기장 초기 스키마 · RLS
-- Supabase SQL Editor에서 전체 블록을 그대로 실행하면 된다.
-- auth.users 테이블은 Supabase Auth가 내장으로 제공한다.

-- ============================================================
-- 1. 테이블
-- ============================================================

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  category text not null check (category in ('일상','운동','여행','업무','감정','기타')),
  content text not null,
  emotion_emoji text,
  hashtags text[] not null default '{}',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diaries_user_id_date_idx
  on public.diaries (user_id, date desc);

create table if not exists public.diary_shares (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  shared_with_email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (diary_id, shared_with_email)
);

create index if not exists diary_shares_shared_with_email_idx
  on public.diary_shares (shared_with_email);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists diaries_set_updated_at on public.diaries;
create trigger diaries_set_updated_at
  before update on public.diaries
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 2. RLS 활성화
-- ============================================================

alter table public.diaries enable row level security;
alter table public.diary_shares enable row level security;

-- ============================================================
-- 3. diaries 정책
-- ============================================================

-- SECURITY DEFINER 함수로 diary_shares 조회를 감싸서 diaries ↔ diary_shares 사이의
-- 정책 순환 참조(infinite recursion)를 방지한다. 함수 내부는 RLS를 우회하므로
-- 호출 트리거인 diaries SELECT 정책에서 다시 diary_shares RLS를 평가하지 않는다.
create or replace function public.is_diary_shared_with_me(p_diary_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.diary_shares
    where diary_id = p_diary_id
      and shared_with_email = (select auth.email())
  )
$$;

drop policy if exists "diaries_select_own_or_shared" on public.diaries;
create policy "diaries_select_own_or_shared"
  on public.diaries
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_diary_shared_with_me(id)
  );

drop policy if exists "diaries_insert_own" on public.diaries;
create policy "diaries_insert_own"
  on public.diaries
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "diaries_update_own" on public.diaries;
create policy "diaries_update_own"
  on public.diaries
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "diaries_delete_own" on public.diaries;
create policy "diaries_delete_own"
  on public.diaries
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================
-- 4. diary_shares 정책
-- ============================================================

drop policy if exists "diary_shares_select_involved" on public.diary_shares;
create policy "diary_shares_select_involved"
  on public.diary_shares
  for select
  to authenticated
  using (
    invited_by = (select auth.uid())
    or shared_with_email = (select auth.email())
  );

drop policy if exists "diary_shares_insert_by_owner" on public.diary_shares;
create policy "diary_shares_insert_by_owner"
  on public.diary_shares
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and exists (
      select 1
      from public.diaries d
      where d.id = diary_id
        and d.user_id = (select auth.uid())
    )
  );

drop policy if exists "diary_shares_delete_by_owner" on public.diary_shares;
create policy "diary_shares_delete_by_owner"
  on public.diary_shares
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.diaries d
      where d.id = diary_id
        and d.user_id = (select auth.uid())
    )
  );
