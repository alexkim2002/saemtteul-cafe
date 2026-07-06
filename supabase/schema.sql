-- ============================================================
-- 샘뜰 카페 주문 테이블 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  phone text not null default '',
  items jsonb not null,          -- [{ menuId, name, temperature, size, quantity, unitPrice }]
  total integer not null,        -- 총 금액 (원)
  status text not null default '대기'
    check (status in ('대기', '완료')),
  memo text
);

-- RLS 활성화 + 익명(anon) 키로 읽기/쓰기/수정 허용
-- (교회 카페 내부용 간단 구성입니다. 외부 공개 서비스라면 정책을 더 좁히세요.)
alter table public.orders enable row level security;

drop policy if exists "anon insert orders" on public.orders;
create policy "anon insert orders" on public.orders
  for insert to anon with check (true);

drop policy if exists "anon select orders" on public.orders;
create policy "anon select orders" on public.orders
  for select to anon using (true);

drop policy if exists "anon update orders" on public.orders;
create policy "anon update orders" on public.orders
  for update to anon using (true) with check (true);

-- 관리자 페이지 실시간 갱신을 위해 Realtime 발행에 테이블 추가
alter publication supabase_realtime add table public.orders;

-- ============================================================
-- 메뉴 테이블
-- 관리자 페이지(/admin) > "메뉴" 탭에서 추가/수정/삭제합니다.
-- ============================================================

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  category text not null,
  price integer not null check (price >= 0),
  description text,
  has_temperature boolean not null default false,  -- HOT/ICE 선택 가능 여부
  sold_out boolean not null default false,
  sort_order integer not null default 0            -- 같은 카테고리 안 표시 순서
);

alter table public.menu_items enable row level security;

drop policy if exists "anon select menu" on public.menu_items;
create policy "anon select menu" on public.menu_items
  for select to anon using (true);

drop policy if exists "anon insert menu" on public.menu_items;
create policy "anon insert menu" on public.menu_items
  for insert to anon with check (true);

drop policy if exists "anon update menu" on public.menu_items;
create policy "anon update menu" on public.menu_items
  for update to anon using (true) with check (true);

drop policy if exists "anon delete menu" on public.menu_items;
create policy "anon delete menu" on public.menu_items
  for delete to anon using (true);

-- 기본 메뉴 시드 (테이블이 비어 있을 때만 1회 삽입)
insert into public.menu_items (name, category, price, has_temperature, description, sort_order)
select v.name, v.category, v.price, v.has_temperature, v.description, v.sort_order
from (values
  ('아메리카노', '커피', 3000, true, null::text, 10),
  ('카페라떼', '커피', 3500, true, null::text, 20),
  ('바닐라라떼', '커피', 4000, true, null::text, 30),
  ('자몽에이드', '논커피', 4000, false, null::text, 10),
  ('녹차라떼', '논커피', 4000, true, null::text, 20),
  ('바스크 치즈케이크', '디저트', 5000, false, '진한 치즈 풍미의 수제 케이크', 10),
  ('초코칩 쿠키', '디저트', 2500, false, null::text, 20)
) as v(name, category, price, has_temperature, description, sort_order)
where not exists (select 1 from public.menu_items);
