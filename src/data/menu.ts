// ============================================================
// 샘뜰 카페 메뉴
// 메뉴는 Supabase의 menu_items 테이블에서 관리합니다.
// (관리자 페이지 /admin > "메뉴" 탭에서 추가/수정/삭제)
// 아래 FALLBACK_MENU는 Supabase에 연결하지 못했을 때만 쓰이는 예비 메뉴입니다.
// ============================================================

/** 화면에 표시할 카테고리 순서. 여기 없는 카테고리는 뒤에 이름순으로 붙습니다. */
export const CATEGORY_ORDER = ["커피", "논커피", "디저트"];

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  /** HOT/ICE 선택 가능 여부 (음료만 true) */
  hasTemperature: boolean;
  description: string | null;
  soldOut: boolean;
  /** 같은 카테고리 안에서의 표시 순서 (작을수록 위) */
  sortOrder: number;
}

/** Supabase menu_items 테이블 한 행 */
export interface MenuRow {
  id: string;
  name: string;
  category: string;
  price: number;
  has_temperature: boolean;
  description: string | null;
  sold_out: boolean;
  sort_order: number;
}

export function rowToMenuItem(row: MenuRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    hasTemperature: row.has_temperature,
    description: row.description,
    soldOut: row.sold_out,
    sortOrder: row.sort_order,
  };
}

function categoryRank(category: string): number {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

/** 카테고리 순서 → sortOrder → 이름 순으로 정렬 */
export function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.category.localeCompare(b.category, "ko") ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, "ko")
  );
}

/** 메뉴에 실제로 존재하는 카테고리를 표시 순서대로 반환 */
export function orderedCategories(items: MenuItem[]): string[] {
  const seen: string[] = [];
  for (const item of sortMenuItems(items)) {
    if (!seen.includes(item.category)) seen.push(item.category);
  }
  return seen;
}

export const FALLBACK_MENU: MenuItem[] = [
  { id: "americano", name: "아메리카노", category: "커피", price: 3000, hasTemperature: true, description: null, soldOut: false, sortOrder: 10 },
  { id: "cafe-latte", name: "카페라떼", category: "커피", price: 3500, hasTemperature: true, description: null, soldOut: false, sortOrder: 20 },
  { id: "vanilla-latte", name: "바닐라라떼", category: "커피", price: 4000, hasTemperature: true, description: null, soldOut: false, sortOrder: 30 },
  { id: "grapefruit-ade", name: "자몽에이드", category: "논커피", price: 4000, hasTemperature: false, description: null, soldOut: false, sortOrder: 10 },
  { id: "green-tea-latte", name: "녹차라떼", category: "논커피", price: 4000, hasTemperature: true, description: null, soldOut: false, sortOrder: 20 },
  { id: "basque-cheesecake", name: "바스크 치즈케이크", category: "디저트", price: 5000, hasTemperature: false, description: "진한 치즈 풍미의 수제 케이크", soldOut: false, sortOrder: 10 },
  { id: "chocolate-cookie", name: "초코칩 쿠키", category: "디저트", price: 2500, hasTemperature: false, description: null, soldOut: false, sortOrder: 20 },
];
