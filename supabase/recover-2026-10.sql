-- ============================================================
-- 샘뜰 카페 포스 — 밀린 마이그레이션 + 데이터 복구 (1회성)
--
-- 상황: POS 배포(2026-08-29) 후에도 schema.sql이 실행되지 않아
--       payment_method / discount / is_favorite 컬럼이 없는 상태로
--       7주간 운영되었습니다. 그동안 결제수단은 메모에
--       "결제: 계좌이체" / "결제: 현금" 으로 저장되어 있어 복구 가능합니다.
--
-- 사용법: Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run.
--        여러 번 실행해도 안전합니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 컬럼 추가
--    payment_method는 일부러 기본값 없이(nullable) 추가합니다.
--    기본값을 바로 주면 현금 주문까지 계좌이체로 덮어쓰게 됩니다.
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists discount integer not null default 0;

alter table public.orders
  add column if not exists payment_method text;

-- ------------------------------------------------------------
-- 2. 메모에 남아 있는 결제수단을 컬럼으로 복구
-- ------------------------------------------------------------
update public.orders
   set payment_method = '현금'
 where payment_method is null
   and memo like '%결제: 현금%';

-- 나머지(포스 도입 전 주문 포함)는 계좌이체로 — 그 시절엔 이체만 받았습니다
update public.orders
   set payment_method = '계좌이체'
 where payment_method is null;

-- ------------------------------------------------------------
-- 3. 포스 도입 전 텀블러 할인 복구
--    당시 메모 형식: "텀블러 지참 (-500원 할인)"
--    total에는 이미 할인이 반영되어 있고, discount 칸만 비어 있습니다.
-- ------------------------------------------------------------
update public.orders
   set discount = 500
 where discount = 0
   and memo like '텀블러 지참%';

-- ------------------------------------------------------------
-- 4. 복구가 끝났으니 기본값·제약조건 적용
-- ------------------------------------------------------------
alter table public.orders alter column payment_method set default '계좌이체';
alter table public.orders alter column payment_method set not null;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('계좌이체', '현금'));

-- ------------------------------------------------------------
-- 5. 즐겨찾기 컬럼 (⭐ 자주 쓰는)
-- ------------------------------------------------------------
alter table public.menu_items
  add column if not exists is_favorite boolean not null default false;

-- ------------------------------------------------------------
-- 6. (선택) 메모 정리
--    결제수단이 이제 컬럼에 들어갔으므로, 메모에 남은
--    "결제: 계좌이체" 같은 중복 문구를 지웁니다.
--    주문내역 화면에서 "메모: 결제: 계좌이체" 가 사라집니다.
--    남겨두고 싶으면 이 블록만 지우고 실행하세요.
-- ------------------------------------------------------------
update public.orders
   set memo = null
 where memo in ('결제: 계좌이체', '결제: 현금');

-- ------------------------------------------------------------
-- 7. 결과 확인
-- ------------------------------------------------------------
select payment_method,
       count(*)      as 건수,
       sum(total)    as 매출,
       sum(discount) as 할인
  from public.orders
 group by payment_method
 order by payment_method;
