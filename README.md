# ✝️ 샘뜰 카페 (봉원교회 카페) 주문 홈페이지

Next.js + Tailwind CSS + Supabase로 만든 카페 주문/관리 시스템입니다.

- **고객 페이지** `/` — 메뉴 보기 → 옵션(HOT/ICE) 선택 → 장바구니 → 텀블러 지참 시 500원 할인 → 이름 입력 후 주문 (완료 화면에 계좌이체 안내)
- **관리자 페이지** `/admin` — 비밀번호 입장 후 세 개 탭:
  - **주문**: 실시간 주문 목록, 상태 변경(대기 → 완료), 오류 주문 삭제, 수동 주문 추가
  - **매출**: 달력에서 날짜를 골라 하루 단위 매출·주문 수·평균·메뉴별 판매 확인 (달력에 일별 매출 표시, 월 합계 제공)
  - **메뉴**: 메뉴 추가/수정/삭제, 품절 토글 (수정 즉시 주문 페이지에 반영)

배포 주소: https://seamtteul-cafe.vercel.app (main 브랜치에 push하면 Vercel이 자동 재배포)

---

## 1. 처음 실행하기

```bash
npm install
npm run dev
```

http://localhost:3000 접속. **Supabase 설정 전에도 화면은 뜨지만**(내장 예비 메뉴 표시),
주문 저장/조회와 메뉴 관리는 아래 설정을 마쳐야 동작합니다.

## 2. Supabase 연결 (5분)

1. https://supabase.com 에서 무료 프로젝트를 만듭니다.
2. 대시보드 왼쪽 **SQL Editor** 에 `supabase/schema.sql` 파일 내용을 붙여넣고 **Run** 합니다.
   (orders/menu_items 테이블 + 접근 정책 + 기본 메뉴 시드 + 실시간 설정이 한 번에 생성됩니다)
3. 대시보드 **Project Settings > API** 에서 두 값을 복사합니다:
   - `Project URL`
   - `anon public` (publishable) 키
4. 프로젝트 루트의 `.env.local.example`을 복사해 `.env.local` 파일을 만들고 값을 채웁니다:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=발급받은_키
ADMIN_PASSWORD=원하는비밀번호
```

5. dev 서버를 재시작합니다 (`Ctrl+C` 후 `npm run dev`).

## 3. 메뉴 수정하는 법

**관리자 페이지(`/admin`) > 메뉴 탭**에서 추가/수정/삭제/품절 처리를 하면 됩니다.
코드 수정이나 재배포 없이 즉시 주문 페이지에 반영됩니다.

`src/data/menu.ts`의 `FALLBACK_MENU`는 Supabase에 연결하지 못했을 때만 쓰이는
예비 메뉴이므로 평소에는 손댈 필요가 없습니다.

## 4. 관리자 페이지 인증

- 주소: `/admin` · 비밀번호: `ADMIN_PASSWORD` 환경변수 값
- 비밀번호 검증은 서버 API(`/api/admin/login`)에서 하고, 성공 시 httpOnly 세션 쿠키(7일)가
  발급됩니다. 비밀번호는 브라우저에 노출되지 않습니다.
- Vercel 배포 시 프로젝트 **Settings > Environment Variables**에 `ADMIN_PASSWORD`를 등록해야 합니다.
- 새 주문은 Supabase Realtime으로 자동 갱신됩니다. (안전망으로 15초 폴링 병행)

> ⚠️ 남은 보안 한계: 주문/메뉴 데이터의 읽기·쓰기는 여전히 공개 anon 키 + RLS 정책으로
> 이루어집니다. 교회 내부용으로는 충분하지만, 외부에 완전히 공개할 서비스라면
> 데이터 작업도 서버 API로 옮기거나 Supabase Auth 기반으로 정책을 좁히세요.

## 폴더 구조

```
src/
  app/
    page.tsx            # 고객 주문 페이지 (/)
    admin/page.tsx      # 관리자 페이지 (/admin) — 주문/매출/메뉴 탭
    api/admin/          # 관리자 로그인/세션 API (서버 측 인증)
    layout.tsx          # 공통 레이아웃/메타데이터
    globals.css         # 전역 스타일 (밝은 테마 고정, 모바일 터치 보정)
  data/
    menu.ts             # 메뉴 타입 + 예비(폴백) 메뉴
  lib/
    supabase.ts         # Supabase 클라이언트
    menu.ts             # 메뉴 불러오기 (DB 우선, 실패 시 폴백)
    types.ts            # 주문 타입/포맷 함수
    adminAuth.ts        # 관리자 세션 토큰 (서버 전용)
supabase/
  schema.sql            # DB 테이블/정책/시드 SQL (Supabase SQL Editor에서 실행)
```
