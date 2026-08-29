// 주문 관련 공용 타입

/**
 * POS에서 받은 주문은 결제와 동시에 "완료"로 기록됩니다.
 * "대기"는 음료를 먼저 만들어야 할 때 수동으로 돌려놓을 수 있는 상태입니다.
 */
export type OrderStatus = "대기" | "완료";

export const ORDER_STATUSES: OrderStatus[] = ["대기", "완료"];

/** 결제수단 — 매출 탭에서 수단별로 합계를 냅니다 */
export type PaymentMethod = "계좌이체" | "현금";

export const PAYMENT_METHODS: PaymentMethod[] = ["계좌이체", "현금"];

/** 결제수단이 비어 있는 과거 주문은 계좌이체로 간주합니다 */
export function paymentMethodOf(order: Pick<Order, "payment_method">): PaymentMethod {
  return order.payment_method === "현금" ? "현금" : "계좌이체";
}

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
  /** 텀블러(개인컵) 지참 — 이 줄에만 할인이 붙습니다 */
  tumbler?: boolean;
}

/** Supabase orders 테이블 한 행 */
export interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  /** 과거 주문 호환용. 현재는 수집하지 않습니다. */
  phone: string | null;
  items: OrderItem[];
  /** 할인까지 반영된 실제 받은 금액 (원) */
  total: number;
  /** 텀블러 할인 등 깎아준 금액 (원). 마이그레이션 전 주문은 null */
  discount: number | null;
  /** 결제수단. 마이그레이션 전 주문은 null */
  payment_method: PaymentMethod | null;
  status: OrderStatus;
  memo: string | null;
}

/** 할인 전 금액 */
export function orderSubtotal(order: Pick<Order, "total" | "discount">): number {
  return order.total + (order.discount ?? 0);
}

/** 주문 항목 한 줄 표시용 텍스트 (예: "아메리카노 (ICE) x2 🥤") */
export function formatOrderItem(item: OrderItem): string {
  const opts = [item.temperature, item.size === "Large" ? "Large" : null]
    .filter(Boolean)
    .join("/");
  return `${item.name}${opts ? ` (${opts})` : ""} x${item.quantity}${
    item.tumbler ? " 🥤" : ""
  }`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

/** 텀블러를 지참한 잔 수 */
export function tumblerCount(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + (i.tumbler ? i.quantity : 0), 0);
}

/** 주문 항목 합계 (할인 전) */
export function itemsTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}
