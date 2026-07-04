# ☕ 샘뜰 카페 (봉원교회 카페) 주문 홈페이지

Next.js + Tailwind CSS + Supabase로 만든 카페 주문 시스템입니다.

- **고객 페이지** `/` — 메뉴 보기 → 옵션(HOT/ICE, 사이즈) 선택 → 장바구니 → 이름/연락처 입력 후 주문
- **관리자 페이지** `/admin` — 비밀번호 입장, 주문 실시간 목록, 상태 변경(대기→준비중→완료), 수동 주문 추가

---

## 1. 처음 실행하기

```bash
npm install
npm run dev
```

http://localhost:3000 접속. **Supabase 설정 전에도 화면은 뜨지만**, 주문 저장/조회는 아래 설정을 마쳐야 동작합니다.

## 2. Supabase 연결 (5분)

1. https://supabase.com 에서 무료 프로젝트를 만듭니다.
2. 대시보드 왼쪽 **SQL Editor** 에 `supabase/schema.sql` 파일 내용을 붙여넣고 **Run** 합니다.
   (orders 테이블 + 접근 정책 + 실시간 설정이 한 번에 생성됩니다)
3. 대시보드 **Project Settings > API** 에서 두 값을 복사합니다:
   - `Project URL`
   - `anon public` 키
4. 프로젝트 루트의 `.env.local.example`을 복사해 `.env.local` 파일을 만들고 값을 채웁니다:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_ADMIN_PASSWORD=원하는비밀번호
```

5. dev 서버를 재시작합니다 (`Ctrl+C` 후 `npm run dev`).

## 3. 메뉴 수정하는 법

**`src/data/menu.ts`** 파일 하나만 수정하면 됩니다.
이름/가격/카테고리 변경, 메뉴 추가·삭제, `soldOut: true`로 품절 처리, `SIZE_UPCHARGE`로 Large 추가금 조정이 모두 이 파일에서 가능합니다.

## 4. 관리자 페이지

- 주소: http://localhost:3000/admin
- 비밀번호: `.env.local`의 `NEXT_PUBLIC_ADMIN_PASSWORD` (미설정 시 기본값 `samteul1234`)
- 새 주문이 들어오면 Supabase Realtime으로 자동 갱신됩니다. (안전망으로 15초마다 폴링도 병행)

> ⚠️ 이 비밀번호 보호는 교회 내부용 간단 잠금입니다. 브라우저에 키가 노출되는 구조이므로,
> 외부에 완전히 공개할 서비스라면 Supabase Auth 등 정식 인증으로 교체하세요.

## 폴더 구조

```
src/
  app/
    page.tsx          # 고객 주문 페이지 (/)
    admin/page.tsx    # 관리자 페이지 (/admin)
    layout.tsx        # 공통 레이아웃/메타데이터
  data/
    menu.ts           # ★ 메뉴 설정 (여기만 고치면 메뉴 변경)
  lib/
    supabase.ts       # Supabase 클라이언트
    types.ts          # 주문 타입/포맷 함수
supabase/
  schema.sql          # DB 테이블 생성 SQL
```
