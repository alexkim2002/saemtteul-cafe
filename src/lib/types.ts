// 주문 관련 공용 타입

export type OrderStatus = "대기" | "준비중" | "완료";

export const ORDER_STATUSES: OrderStatus[] = ["대기", "준비중", "완료"];

/** 주문에 담긴 개별 항목 (Supabase orders.items jsonb에 저장되는 형태) */
export interface OrderItem {
  menuId: string;
  name: string;
  temperature: "HOT" | "ICE" | null;
  /** 과거 주문 호환용. 현재는 Regular 단일 사이즈라 새 주문에는 저장하지 않습니다. */
  size?: "Regular" | "Large" | null;
  quantity: number;
  /** 1개 가격 (원) */
  unitPrice: number;
}

/** Supabase orders 테이블 한 행 */
export interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  /** 과거 주문 호환용. 현재는 수집하지 않습니다. */
  phone: string | null;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  memo: string | null;
}

/** 주문 항목 한 줄 표시용 텍스트 (예: "아메리카노 (ICE) x2") */
export function formatOrderItem(item: OrderItem): string {
  const opts = [item.temperature, item.size === "Large" ? "Large" : null]
    .filter(Boolean)
    .join("/");
  return `${item.name}${opts ? ` (${opts})` : ""} x${item.quantity}`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}
