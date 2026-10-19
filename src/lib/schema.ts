// ============================================================
// DB 스키마 점검
//
// 2026년 8~10월에 schema.sql이 실행되지 않은 채로 7주간 운영되면서
// 결제수단·할인이 컬럼에 저장되지 못한 일이 있었습니다. (주문은 메모로
// 우회 저장되어 복구했지만, 그동안 아무 경고도 보이지 않았습니다)
// 그래서 포스를 열 때마다 필요한 컬럼이 있는지 직접 확인하고,
// 없으면 가려지지 않는 위치에 경고를 띄웁니다.
// ============================================================

import { SupabaseClient } from "@supabase/supabase-js";

export interface MissingColumn {
  table: string;
  column: string;
  note: string;
}

/** 포스가 동작하는 데 필요한 컬럼 — 테이블별로 묶어 둡니다 */
const REQUIRED: { table: string; columns: { column: string; note: string }[] }[] = [
  {
    table: "orders",
    columns: [
      { column: "payment_method", note: "결제수단(계좌이체/현금)" },
      { column: "discount", note: "텀블러 할인 금액" },
    ],
  },
  {
    table: "menu_items",
    columns: [{ column: "is_favorite", note: "⭐ 즐겨찾기" }],
  },
];

function isMissingColumnError(code: string | undefined, message: string) {
  return code === "PGRST204" || code === "42703" || /column .* does not exist/.test(message);
}

/**
 * 없는 컬럼 목록을 돌려줍니다. 빈 배열이면 정상입니다.
 *
 * 테이블당 딱 한 번만 조회합니다. 한 테이블에서 하나라도 빠지면 그 테이블의
 * 컬럼을 모두 "없음"으로 봅니다 — 어차피 복구 SQL 한 번으로 같이 채워지고,
 * 컬럼을 하나씩 찾겠다고 실패하는 요청을 더 날리면 콘솔만 지저분해집니다.
 *
 * 조회 실패가 네트워크 문제일 수도 있으므로, 컬럼 없음 오류일 때만 경고합니다.
 */
export async function findMissingColumns(
  supabase: SupabaseClient
): Promise<MissingColumn[]> {
  const perTable = await Promise.all(
    REQUIRED.map(async ({ table, columns }) => {
      const { error } = await supabase
        .from(table)
        .select(columns.map((c) => c.column).join(","))
        .limit(1);
      if (!error || !isMissingColumnError(error.code, error.message)) return [];
      return columns.map((c) => ({ table, column: c.column, note: c.note }));
    })
  );
  return perTable.flat();
}
