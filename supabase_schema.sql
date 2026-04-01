-- ============================================================
-- BuyerOS — Supabase 새 회사 계정용 스키마 (완전판 v2)
-- Supabase Dashboard > SQL Editor > 전체 붙여넣고 실행
-- ============================================================

-- 1. 고객사 (slug 포함 — URL 접근용)
create table public.customers (
  id         uuid default gen_random_uuid() primary key,
  name       text not null unique,
  slug       text not null unique,  -- URL용: deta.ai.kr/client/sammi
  created_at timestamptz default now()
);
alter table public.customers enable row level security;
-- 인증된 팀원 전체 접근
create policy "authenticated 전체 접근" on public.customers
  for all using (auth.role() = 'authenticated');
-- 비로그인 고객도 slug로 조회 가능 (anon 허용)
create policy "anon slug 조회" on public.customers
  for select using (true);

-- 2. 바이어
create table public.buyers (
  id              uuid default gen_random_uuid() primary key,
  customer_id     uuid references public.customers(id) on delete cascade not null,
  no              integer,
  company         text not null,
  country         text not null default '',
  website         text,
  contact_name    text,
  position        text,
  email           text,
  phone           text,
  summary         text,
  notes           text,
  follow_up       text,
  status          text not null default 'pending'
                  check (status in ('pending','contacted','replied','meeting','closed','rejected')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.buyers enable row level security;
create policy "authenticated 전체 접근" on public.buyers
  for all using (auth.role() = 'authenticated');
-- 고객(anon)은 통계 조회만 — 실제 이메일/연락처는 노출 안 함
create policy "anon 통계용 조회" on public.buyers
  for select using (true);
create index idx_buyers_customer_id on public.buyers(customer_id);
create index idx_buyers_status on public.buyers(status);

-- 3. 컨택 로그
create table public.contact_logs (
  id             uuid default gen_random_uuid() primary key,
  buyer_id       uuid references public.buyers(id) on delete cascade not null,
  attempt_no     integer not null check (attempt_no between 1 and 10),
  contact_date   text,
  contact_method text,
  replied        boolean,
  result         text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(buyer_id, attempt_no)
);
alter table public.contact_logs enable row level security;
create policy "authenticated 전체 접근" on public.contact_logs
  for all using (auth.role() = 'authenticated');
create index idx_contact_logs_buyer_id on public.contact_logs(buyer_id);

-- 4. 캠페인 (Agent 실행 단위)
create table public.campaigns (
  id               uuid default gen_random_uuid() primary key,
  customer_id      uuid references public.customers(id) on delete cascade not null,
  status           text not null default 'draft'
                   check (status in (
                     'draft','running','abm_done','templates_done',
                     'review_pending','r1_sent','r2_sent','r3_sent','error'
                   )),
  campaign_info    jsonb not null default '{}',
  abm_analysis     jsonb,
  email_templates  jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.campaigns enable row level security;
create policy "authenticated 전체 접근" on public.campaigns
  for all using (auth.role() = 'authenticated');
create index idx_campaigns_customer_id on public.campaigns(customer_id);

-- 5. updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_buyers_updated before update on public.buyers
  for each row execute procedure public.set_updated_at();
create trigger trg_contact_logs_updated before update on public.contact_logs
  for each row execute procedure public.set_updated_at();
create trigger trg_campaigns_updated before update on public.campaigns
  for each row execute procedure public.set_updated_at();

-- 6. 대시보드용 통계 뷰
create or replace view public.buyer_stats as
select
  b.customer_id,
  c.name as customer_name,
  count(*)                                                    as total,
  count(*) filter (where b.status != 'pending')               as contacted,
  count(*) filter (where b.status in ('replied','meeting'))   as replied,
  count(*) filter (where b.status = 'meeting')                as in_meeting,
  count(*) filter (where b.status = 'closed')                 as closed,
  round(
    count(*) filter (where b.status in ('replied','meeting','closed'))::numeric
    / nullif(count(*) filter (where b.status != 'pending'), 0) * 100, 1
  ) as reply_rate
from public.buyers b
join public.customers c on c.id = b.customer_id
group by b.customer_id, c.name;

-- ============================================================
-- 7. 유저 프로필 & 권한 (customer / viewer / editor)
-- ============================================================

create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'viewer'
              check (role in ('customer', 'viewer', 'editor')),
  customer_id uuid references public.customers(id) on delete set null,
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id);
create policy "editor 전체 조회" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'editor')
  );
create policy "editor 수정" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'editor')
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 8. 프로젝트 타임라인
--    기본 6단계 고정, 연장 시 7,8,9... 단계 추가 가능
-- ============================================================

create table public.timelines (
  id          uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  step_no     integer not null,   -- 기본 1~6, 연장 시 7,8,9...
  step_name   text not null,
  start_date  date,
  end_date    date,
  status      text not null default 'pending'
              check (status in ('done', 'in_progress', 'pending')),
  memo        text,
  updated_at  timestamptz default now(),
  unique(customer_id, step_no)
);
alter table public.timelines enable row level security;
-- 팀원
create policy "authenticated 전체 접근" on public.timelines
  for all using (auth.role() = 'authenticated');
-- 고객(anon)도 조회 가능
create policy "anon 조회" on public.timelines
  for select using (true);

-- 기본 6단계 자동 삽입 함수
create or replace function public.init_timeline(p_customer_id uuid)
returns void language plpgsql as $$
begin
  insert into public.timelines (customer_id, step_no, step_name, status) values
    (p_customer_id, 1, '진출 전략',          'pending'),
    (p_customer_id, 2, '바이어리스트개발',    'pending'),
    (p_customer_id, 3, '1차 Contact',         'pending'),
    (p_customer_id, 4, '1차 Contact Feedback','pending'),
    (p_customer_id, 5, '2차 Contact',         'pending'),
    (p_customer_id, 6, '최종 결과 보고',      'pending')
  on conflict (customer_id, step_no) do nothing;
end;
$$;

-- ============================================================
-- 9. 미팅
-- ============================================================

create table public.meetings (
  id            uuid default gen_random_uuid() primary key,
  customer_id   uuid references public.customers(id) on delete cascade not null,
  buyer_id      uuid references public.buyers(id) on delete set null,
  title         text not null,
  meeting_date  timestamptz,
  location      text,
  status        text not null default 'scheduled'
                check (status in ('scheduled','done','cancelled')),
  notes         text,
  created_at    timestamptz default now()
);
alter table public.meetings enable row level security;
create policy "authenticated 전체 접근" on public.meetings
  for all using (auth.role() = 'authenticated');
create policy "anon 조회" on public.meetings
  for select using (true);

-- ============================================================
-- 10. 프로젝트 파일 (Supabase Storage 연동)
-- ============================================================

create table public.project_files (
  id           uuid default gen_random_uuid() primary key,
  customer_id  uuid references public.customers(id) on delete cascade not null,
  name         text not null,
  category     text not null default 'report'
               check (category in ('buyer_list','report','strategy','other')),
  storage_path text not null,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz default now()
);
alter table public.project_files enable row level security;
create policy "authenticated 전체 접근" on public.project_files
  for all using (auth.role() = 'authenticated');
create policy "anon 조회" on public.project_files
  for select using (true);

-- ============================================================
-- 11. 고객 문의
-- ============================================================

create table public.inquiries (
  id          uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  author_name text,          -- 비로그인 고객이므로 이름 직접 입력
  title       text not null,
  content     text not null,
  status      text not null default 'open'
              check (status in ('open','answered','closed')),
  answer      text,
  created_at  timestamptz default now(),
  answered_at timestamptz
);
alter table public.inquiries enable row level security;
create policy "authenticated 전체 접근" on public.inquiries
  for all using (auth.role() = 'authenticated');
-- 고객(anon)은 작성 + 본인 고객사 조회
create policy "anon 조회/작성" on public.inquiries
  for all using (true);

-- ============================================================
-- Storage 버킷 생성 (SQL Editor에서 실행)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict do nothing;

-- Storage 정책: 인증된 팀원만 업로드, 조회는 서비스 롤로
create policy "editor 업로드" on storage.objects
  for insert with check (
    bucket_id = 'project-files' and auth.role() = 'authenticated'
  );
create policy "authenticated 다운로드" on storage.objects
  for select using (bucket_id = 'project-files');

-- ============================================================
-- 완료!
-- 팀원 초대: Dashboard > Authentication > Users > Invite User
-- 초대 후 profiles 테이블에서 role 설정 (기본값: viewer)
--
-- 고객사 추가 예시:
-- insert into customers (name, slug) values ('삼미', 'sammi');
-- select init_timeline('방금-생성된-customer-id');
--
-- 고객 접속 URL: deta.ai.kr/client/sammi
-- ============================================================
