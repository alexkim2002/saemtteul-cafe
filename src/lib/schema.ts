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

/** 포스가 동작하는 데 필요한 컬럼 목록 */
const REQUIRED_COLUMNS: { table: string; column: string; note: string }[] = [
  { table: "orders", column: "payment_method", note: "결제수단(계좌이체/현금)" },
  { table: "orders", column: "discount", note: "텀블러 할인 금액" },
  { table: "menu_items", column: "is_favorite", note: "⭐ 즐겨찾기" },
];

export interface MissingColumn {
  table: string;
  column: string;
  note: string;
}

function isMissingColumnError(code: string | undefined, message: string, column: string) {
  return code === "PGRST204" || code === "42703" || message.includes(column);
}

/**
 * 없는 컬럼 목록을 돌려줍니다. 빈 배열이면 정상입니다.
 * 조회에 실패(네트워크 등)하면 섣불리 경고하지 않도록 빈 배열을 반환합니다.
 */
export async function findMissingColumns(
  supabase: SupabaseClient
): Promise<MissingColumn[]> {
  const results = await Promise.all(
    REQUIRED_COLUMNS.map(async (required) => {
      const { error } = await supabase
        .from(required.table)
        .select(required.column)
        .limit(1);
      if (!error) return null;
      return isMissingColumnError(error.code, error.message, required.column)
        ? required
        : null;
    })
  );
  return results.filter((r): r is MissingColumn => r !== null);
}
