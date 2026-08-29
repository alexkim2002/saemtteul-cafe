"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dayKeyOf,
  dayRange,
  formatDayLabel,
  formatTime,
  shiftDay,
} from "@/lib/date";
import { getSupabase } from "@/lib/supabase";
import {
  Order,
  OrderStatus,
  PAYMENT_METHODS,
  formatOrderItem,
  formatPrice,
  orderSubtotal,
  paymentMethodOf,
} from "@/lib/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  대기: "bg-amber-50 text-amber-600",
  완료: "bg-blue-50 text-blue-600",
};

export default function OrdersTab({ refreshKey }: { refreshKey: number }) {
  const todayKey = useMemo(() => dayKeyOf(new Date()), []);
  const [dayKey, setDayKey] = useState(todayKey);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabase(), []);

  const fetchOrders = useCallback(async () => {
    if (!supabase) return;
    const { start, end } = dayRange(dayKey);
    const { data, error: dbError } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true })
      .limit(500);
    if (dbError) {
      setError(`주문을 불러오지 못했습니다: ${dbError.message}`);
      setOrders([]);
    } else {
      setError(null);
      setOrders((data ?? []) as Order[]);
    }
  }, [supabase, dayKey]);

  // 날짜 변경 / POS 결제 후 갱신 + 다른 기기에서 들어온 주문 실시간 반영
  useEffect(() => {
    if (!supabase) return;
    // setState는 fetch 완료 후 비동기 콜백에서 실행됨 (동기 렌더 연쇄 없음)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();

    const channel = supabase
      .channel("orders-history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchOrders, refreshKey]);

  async function updateStatus(order: Order, status: OrderStatus) {
    if (!supabase) return;
    setOrders((prev) =>
      (prev ?? []).map((o) => (o.id === order.id ? { ...o, status } : o))
    );
    const { error: dbError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", order.id);
    if (dbError) {
      setError(`상태 변경 실패: ${dbError.message}`);
      fetchOrders();
    }
  }

  /** 잘못 찍힌 주문 삭제 — 매출 집계에서도 빠집니다 */
  async function deleteOrder(order: Order) {
    if (!supabase) return;
    setOrders((prev) => (prev ?? []).filter((o) => o.id !== order.id));
    // .select()로 실제 삭제된 행을 돌려받아, RLS 정책이 없어 조용히
    // 실패하는 경우(0건 삭제)도 오류로 알려줍니다.
    const { data, error: dbError } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id)
      .select("id");
    if (dbError || !data || data.length === 0) {
      setError(
        dbError
          ? `주문 삭제 실패: ${dbError.message}`
          : "주문 삭제 실패: 삭제 권한 정책이 없습니다. supabase/schema.sql을 SQL Editor에서 실행해 주세요."
      );
      fetchOrders();
    }
  }

  const summary = useMemo(() => {
    const list = orders ?? [];
    const byMethod = new Map<string, number>();
    for (const o of list) {
      const method = paymentMethodOf(o);
      byMethod.set(method, (byMethod.get(method) ?? 0) + o.total);
    }
    return {
      count: list.length,
      revenue: list.reduce((sum, o) => sum + o.total, 0),
      discount: list.reduce((sum, o) => sum + (o.discount ?? 0), 0),
      byMethod,
      pending: list.filter((o) => o.status === "대기").length,
    };
  }, [orders]);

  // 최신 주문이 위로. 번호는 그날 몇 번째 주문인지 기준입니다.
  const rows = useMemo(
    () =>
      (orders ?? [])
        .map((order, index) => ({ order, seq: index + 1 }))
        .reverse(),
    [orders]
  );

  return (
    <section>
      {/* 날짜 이동 */}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-3 py-2.5 shadow-sm">
        <button
          onClick={() => setDayKey((d) => shiftDay(d, -1))}
          aria-label="이전 날"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-bold text-gray-900">{formatDayLabel(dayKey)}</div>
          <div className="text-xs text-gray-400">
            {dayKey === todayKey ? "오늘 · 실시간 갱신" : dayKey}
          </div>
        </div>
        <div className="flex gap-2">
          {dayKey !== todayKey && (
            <button
              onClick={() => setDayKey(todayKey)}
              className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 transition hover:bg-blue-100"
            >
              오늘
            </button>
          )}
          <button
            onClick={() => setDayKey((d) => shiftDay(d, 1))}
            aria-label="다음 날"
            disabled={dayKey >= todayKey}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {/* 그날 요약 */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryCard label="주문" value={`${summary.count}건`} />
        <SummaryCard
          label="매출"
          value={formatPrice(summary.revenue)}
          accent
        />
        {PAYMENT_METHODS.map((m) => (
          <SummaryCard
            key={m}
            label={m}
            value={formatPrice(summary.byMethod.get(m) ?? 0)}
          />
        ))}
      </div>

      {summary.pending > 0 && (
        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
          아직 만들지 않은 주문 {summary.pending}건이 있습니다.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {orders === null ? (
        <p className="py-16 text-center text-gray-400">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-gray-400">이 날짜에는 주문이 없습니다.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ order, seq }) => (
            <OrderRow
              key={order.id}
              order={order}
              seq={seq}
              onUpdateStatus={updateStatus}
              onDelete={deleteOrder}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 px-1 text-xs text-gray-400">
        * 매출은 할인까지 반영된 실제 받은 금액 기준입니다.
        {summary.discount > 0 && ` (이 날 할인 합계 ${formatPrice(summary.discount)})`}
      </p>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold ${
          accent ? "text-blue-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  seq,
  onUpdateStatus,
  onDelete,
}: {
  order: Order;
  seq: number;
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
  onDelete: (order: Order) => void;
}) {
  // 삭제는 실수 방지를 위해 "삭제 → 정말 삭제" 두 번 눌러야 확정
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const method = paymentMethodOf(order);
  const discount = order.discount ?? 0;

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500">
            #{seq}
          </span>
          <span className="truncate font-bold text-gray-900">
            {order.customer_name}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
              method === "현금"
                ? "bg-gray-100 text-gray-600"
                : "bg-blue-50 text-blue-600"
            }`}
          >
            {method}
          </span>
          {order.status === "대기" && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE.대기}`}
            >
              대기
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm text-gray-400">
          {formatTime(order.created_at)}
        </span>
      </div>

      <ul className="mb-2 text-sm text-gray-600">
        {order.items.map((item, i) => (
          <li key={i}>· {formatOrderItem(item)}</li>
        ))}
      </ul>

      {order.memo && <p className="mb-2 text-xs text-gray-400">메모: {order.memo}</p>}

      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-gray-900">
          {formatPrice(order.total)}
          {discount > 0 && (
            <span className="ml-1.5 text-xs font-medium text-gray-400 line-through">
              {formatPrice(orderSubtotal(order))}
            </span>
          )}
        </span>
        <div className="flex gap-2">
          {confirmingDelete ? (
            <>
              <span className="self-center text-xs text-red-500">
                매출에서도 제외됩니다
              </span>
              <button
                onClick={() => onDelete(order)}
                className="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-600"
              >
                정말 삭제
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-100"
              >
                삭제
              </button>
              <button
                onClick={() =>
                  onUpdateStatus(order, order.status === "완료" ? "대기" : "완료")
                }
                className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
              >
                {order.status === "완료" ? "대기로" : "완료 처리 ✓"}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
