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
 * 연결 실패·테이블 없음이면 FALLBACK_MENU를 반환하므로 주문 페이지는
 * 어떤 상황에서도 화면이 깨지지 않습니다.
 * 테이블이 있지만 비어 있는 경우는 정상 상태(fromDb: true)로 취급해야
 * 관리자 메뉴 탭에서 새 메뉴를 추가할 수 있습니다.
 */
export async function fetchMenu(
  supabase: SupabaseClient | null
): Promise<MenuFetchResult> {
  if (!supabase) return { items: sortMenuItems(FALLBACK_MENU), fromDb: false };

  const { data, error } = await supabase.from("menu_items").select("*");
  if (error || !data) {
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
