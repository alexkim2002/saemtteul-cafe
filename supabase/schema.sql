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
    check (status in ('대기', '준비중', '완료')),
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
