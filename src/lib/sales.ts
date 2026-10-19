// ============================================================
// 매출 집계 — 화면과 무관한 순수 함수만 둡니다.
// 나중에 다른 포스 환경(전용 하드웨어 등)으로 옮길 때
// 이 파일과 types/config/date만 가져가면 계산 규칙이 그대로 따라옵니다.
// ============================================================

import {
  Order,
  PAYMENT_METHODS,
  PaymentMethod,
  formatPrice,
  paymentMethodOf,
  tumblerCount,
} from "@/lib/types";

export interface MethodAgg {
  revenue: number;
  count: number;
}

export interface SalesSummary {
  /** 주문 건수 */
  count: number;
  /** 할인까지 반영된 실제 받은 금액 합계 */
  revenue: number;
  /** 깎아준 금액 합계 */
  discount: number;
  /** 텀블러 지참 잔 수 */
  tumblers: number;
  /** 아직 완료 처리하지 않은 주문 수 */
  pending: number;
  /** 평균 주문 금액 */
  average: number;
  byMethod: Map<PaymentMethod, MethodAgg>;
}

export function summarizeOrders(orders: Order[]): SalesSummary {
  const byMethod = new Map<PaymentMethod, MethodAgg>();
  for (const method of PAYMENT_METHODS) {
    byMethod.set(method, { revenue: 0, count: 0 });
  }

  let revenue = 0;
  let discount = 0;
  let tumblers = 0;
  let pending = 0;

  for (const order of orders) {
    revenue += order.total;
    discount += order.discount ?? 0;
    tumblers += tumblerCount(order.items ?? []);
    if (order.status === "대기") pending += 1;

    const agg = byMethod.get(paymentMethodOf(order))!;
    agg.revenue += order.total;
    agg.count += 1;
  }

  return {
    count: orders.length,
    revenue,
    discount,
    tumblers,
    pending,
    average: orders.length > 0 ? Math.round(revenue / orders.length) : 0,
    byMethod,
  };
}

export function methodAgg(summary: SalesSummary, method: PaymentMethod): MethodAgg {
  return summary.byMethod.get(method) ?? { revenue: 0, count: 0 };
}

export interface MenuSalesRow {
  name: string;
  quantity: number;
  /** 정가 기준 매출 (할인 전) */
  revenue: number;
}

/**
 * 메뉴별 판매 집계.
 * 주문에 담긴 jsonb items를 그대로 쓰므로, 나중에 삭제한 메뉴도 집계에 남습니다.
 */
export function menuBreakdown(orders: Order[]): MenuSalesRow[] {
  const byMenu = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const agg = byMenu.get(item.name) ?? { quantity: 0, revenue: 0 };
      agg.quantity += item.quantity;
      agg.revenue += item.unitPrice * item.quantity;
      byMenu.set(item.name, agg);
    }
  }
  return [...byMenu.entries()]
    .map(([name, agg]) => ({ name, ...agg }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** 매출 기록용 텍스트 (복사해서 장부·메모에 붙이기) */
export function summaryText(dayLabel: string, summary: SalesSummary): string {
  const lines = [
    `[샘뜰 카페] ${dayLabel} 매출`,
    `주문 ${summary.count}건 · 매출 ${formatPrice(summary.revenue)}`,
    ...PAYMENT_METHODS.map((m) => {
      const agg = methodAgg(summary, m);
      return `${m} ${agg.count}건 ${formatPrice(agg.revenue)}`;
    }),
  ];
  if (summary.discount > 0) {
    lines.push(`텀블러 할인 ${summary.tumblers}잔 −${formatPrice(summary.discount)}`);
  }
  return lines.join("\n");
}
