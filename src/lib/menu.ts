import { SupabaseClient } from "@supabase/supabase-js";
import {
  FALLBACK_MENU,
  MenuItem,
  MenuRow,
  rowToMenuItem,
  sortMenuItems,
} from "@/data/menu";

export interface MenuFetchResult {
  items: MenuItem[];
  /** true면 Supabase menu_items 테이블에서 불러온 메뉴 */
  fromDb: boolean;
  error?: string;
}

/**
 * Supabase에서 메뉴를 불러옵니다.
 * 연결 실패·테이블 없음·빈 테이블이면 FALLBACK_MENU를 반환하므로
 * 주문 페이지는 어떤 상황에서도 메뉴를 표시할 수 있습니다.
 */
export async function fetchMenu(
  supabase: SupabaseClient | null
): Promise<MenuFetchResult> {
  if (!supabase) return { items: sortMenuItems(FALLBACK_MENU), fromDb: false };

  const { data, error } = await supabase.from("menu_items").select("*");
  if (error || !data || data.length === 0) {
    return {
      items: sortMenuItems(FALLBACK_MENU),
      fromDb: false,
      error: error?.message,
    };
  }
  return {
    items: sortMenuItems((data as MenuRow[]).map(rowToMenuItem)),
    fromDb: true,
  };
}
