// ============================================================
// 샘뜰 카페 메뉴 설정 파일
// 이 파일만 수정하면 메뉴가 바뀝니다.
// - name: 메뉴 이름
// - category: 아래 CATEGORIES 중 하나
// - price: 기본 가격 (원)
// - hasTemperature: HOT/ICE 선택 가능 여부 (음료만 true)
// - hasSize: 사이즈 선택 가능 여부 (Large는 +SIZE_UPCHARGE원)
// - soldOut: true로 바꾸면 품절 표시
// ============================================================

export const CATEGORIES = ["커피", "논커피", "디저트"] as const;
export type MenuCategory = (typeof CATEGORIES)[number];

/** Large 사이즈 선택 시 추가 금액 (원) */
export const SIZE_UPCHARGE = 500;

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  hasTemperature: boolean;
  hasSize: boolean;
  description?: string;
  soldOut?: boolean;
}

export const MENU: MenuItem[] = [
  // ----- 커피 -----
  {
    id: "americano",
    name: "아메리카노",
    category: "커피",
    price: 3000,
    hasTemperature: true,
    hasSize: true,
  },
  {
    id: "cafe-latte",
    name: "카페라떼",
    category: "커피",
    price: 3500,
    hasTemperature: true,
    hasSize: true,
  },
  {
    id: "vanilla-latte",
    name: "바닐라라떼",
    category: "커피",
    price: 4000,
    hasTemperature: true,
    hasSize: true,
  },

  // ----- 논커피 -----
  {
    id: "grapefruit-ade",
    name: "자몽에이드",
    category: "논커피",
    price: 4000,
    hasTemperature: false, // ICE 전용
    hasSize: true,
  },
  {
    id: "green-tea-latte",
    name: "녹차라떼",
    category: "논커피",
    price: 4000,
    hasTemperature: true,
    hasSize: true,
  },

  // ----- 디저트 -----
  {
    id: "basque-cheesecake",
    name: "바스크 치즈케이크",
    category: "디저트",
    price: 5000,
    hasTemperature: false,
    hasSize: false,
    description: "진한 치즈 풍미의 수제 케이크",
  },
  {
    id: "chocolate-cookie",
    name: "초코칩 쿠키",
    category: "디저트",
    price: 2500,
    hasTemperature: false,
    hasSize: false,
  },
];
