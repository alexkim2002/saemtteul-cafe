import { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { dayKeyOf, dayRange } from "@/lib/date";
import { OrderItem, OrderStatus, PaymentMethod } from "@/lib/types";

export interface NewOrder {
  /** 손님 이름. 비워두면 호출한 쪽에서 "3번" 같은 번호를 넣어 줍니다. */
  customerName: string;
  items: OrderItem[];
  /** 할인까지 반영된 실제 받은 금액 */
  total: number;
  discount: number;
  paymentMethod: PaymentMethod;
  memo: string | null;
  status: OrderStatus;
}

export interface InsertOrderResult {
  error?: string;
  /**
   * true면 payment_method/discount 컬럼이 아직 없어서 기본 컬럼으로만 저장했다는 뜻.
   * (supabase/schema.sql을 다시 실행하면 해결됩니다)
   */
  legacySchema?: boolean;
}

/** PostgREST가 "그런 컬럼 없음"이라고 답했는지 판별 */
function isMissingColumn(error: PostgrestError): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /payment_method|discount/.test(error.message)
  );
}

/**
 * 주문 한 건을 저장합니다.
 * payment_method/discount 컬럼이 아직 없는 DB에서도 주문을 놓치지 않도록,
 * 실패하면 기본 컬럼만으로 한 번 더 시도하고 결제수단은 메모에 남깁니다.
 */
export async function insertOrder(
  supabase: SupabaseClient,
  order: NewOrder
): Promise<InsertOrderResult> {
  const base = {
    customer_name: order.customerName,
    items: order.items,
    total: order.total,
    status: order.status,
    memo: order.memo,
  };

  const { error } = await supabase.from("orders").insert({
    ...base,
    discount: order.discount,
    payment_method: order.paymentMethod,
  });
  if (!error) return {};
  if (!isMissingColumn(error)) return { error: error.message };

  const fallbackMemo = [order.memo, `결제: ${order.paymentMethod}`]
    .filter(Boolean)
    .join(" · ");
  const { error: retryError } = await supabase
    .from("orders")
    .insert({ ...base, memo: fallbackMemo });
  if (retryError) return { error: retryError.message };
  return { legacySchema: true };
}

/** "3번" 형태의 자동 라벨에서 번호만 꺼냅니다 */
const AUTO_LABEL = /^(\d+)번$/;

/**
 * 이름을 입력하지 않았을 때 붙일 주문 번호 라벨 ("3번").
 *
 * 그날 주문 수로만 매기면, 잘못 찍은 주문을 삭제했을 때 카운트가 되돌아가
 * 다음 주문이 같은 번호를 받습니다. (실제로 2026-09-06에 "10번"이 두 건
 * 생겼습니다) 그래서 이미 쓰인 번호의 최댓값과 주문 수 중 큰 쪽 다음으로
 * 매깁니다.
 */
export async function nextOrderLabel(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<string> {
  const { start, end } = dayRange(dayKeyOf(now));
  const { data } = await supabase
    .from("orders")
    .select("customer_name")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .limit(500);

  const rows = (data ?? []) as { customer_name: string | null }[];
  let highest = 0;
  for (const row of rows) {
    const matched = AUTO_LABEL.exec(row.customer_name ?? "");
    if (matched) highest = Math.max(highest, Number(matched[1]));
  }
  return `${Math.max(highest, rows.length) + 1}번`;
}
