import { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { dayRange } from "@/lib/date";
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

/**
 * 이름을 입력하지 않았을 때 붙일 주문 번호 라벨 ("3번").
 * 그날 몇 번째 주문인지로 매깁니다.
 */
export async function nextOrderLabel(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<string> {
  const { start, end } = dayRange(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`
  );
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  return `${(count ?? 0) + 1}번`;
}
