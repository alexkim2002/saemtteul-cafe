"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dayKeyOf, dayRange, formatDayLabel, formatTime, shiftDay } from "@/lib/date";
import { methodAgg, summarizeOrders, summaryText } from "@/lib/sales";
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

export default function OrdersTab({
  refreshKey,
  dayKey,
  onDayChange,
}: {
  refreshKey: number;
  dayKey: string;
  onDayChange: (dayKey: string) => void;
}) {
  const todayKey = useMemo(() => dayKeyOf(new Date()), []);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // 주문이 있는 마지막 날짜 — 빈 날짜를 보고 있을 때 안내합니다
  const [latestDay, setLatestDay] = useState<string | null>(null);

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

  // 예전 주문이 어디까지 있는지 한 번 확인해 둡니다
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("orders")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled || !data?.[0]) return;
        setLatestDay(dayKeyOf(new Date(data[0].created_at as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, refreshKey]);

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

  const summary = useMemo(() => summarizeOrders(orders ?? []), [orders]);

  /** 장부에 옮겨 적기 쉽게 그날 매출 요약을 텍스트로 복사 */
  async function copySummary() {
    const text = summaryText(formatDayLabel(dayKey), summary);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사가 막힌 환경에서는 화면의 숫자를 보고 옮겨 적으면 됩니다
    }
  }

  // 최신 주문이 위로. 번호는 그날 몇 번째 주문인지 기준입니다.
  const rows = useMemo(
    () => (orders ?? []).map((order, index) => ({ order, seq: index + 1 })).reverse(),
    [orders]
  );

  return (
    <section>
      {/* 날짜 이동 */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
        <button
          onClick={() => onDayChange(shiftDay(dayKey, -1))}
          aria-label="이전 날"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200"
        >
          ‹
        </button>
        {/* 날짜를 누르면 달력이 열립니다 (지난 날짜로 바로 이동) */}
        <div className="relative min-w-0 text-center">
          <div className="truncate font-bold text-gray-900">{formatDayLabel(dayKey)}</div>
          <div className="text-xs text-gray-400">
            {dayKey === todayKey ? "오늘 · 실시간 갱신" : `${dayKey} · 눌러서 날짜 선택`}
          </div>
          <input
            type="date"
            value={dayKey}
            max={todayKey}
            onChange={(e) => e.target.value && onDayChange(e.target.value)}
            aria-label="날짜 선택"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="flex shrink-0 gap-1.5">
          {dayKey !== todayKey && (
            <button
              onClick={() => onDayChange(todayKey)}
              className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 transition hover:bg-blue-100"
            >
              오늘
            </button>
          )}
          <button
            onClick={() => onDayChange(shiftDay(dayKey, 1))}
            aria-label="다음 날"
            disabled={dayKey >= todayKey}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {/* 그날 매출 요약 */}
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="주문" value={`${summary.count}건`} />
        <SummaryCard label="매출" value={formatPrice(summary.revenue)} accent />
        {PAYMENT_METHODS.map((m) => {
          const agg = methodAgg(summary, m);
          return (
            <SummaryCard
              key={m}
              label={m}
              value={formatPrice(agg.revenue)}
              sub={`${agg.count}건`}
            />
          );
        })}
      </div>

      {summary.discount > 0 && (
        <p className="mb-2 px-1 text-xs text-gray-500">
          🥤 텀블러 {summary.tumblers}잔 · 할인 −{formatPrice(summary.discount)} (할인 전{" "}
          {formatPrice(summary.revenue + summary.discount)})
        </p>
      )}

      <button
        onClick={copySummary}
        disabled={!orders || summary.count === 0}
        className={`mb-4 w-full rounded-2xl py-3 text-sm font-bold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400 ${
          copied ? "bg-green-500" : "bg-gray-900 hover:bg-gray-800"
        }`}
      >
        {copied ? "복사했습니다 ✓" : "📋 이 날 매출 요약 복사"}
      </button>

      {summary.pending > 0 && (
        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
          아직 완료 처리하지 않은 주문 {summary.pending}건이 있습니다.
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
        <div className="py-16 text-center">
          <p className="text-gray-400">이 날짜에는 주문이 없습니다.</p>
          {latestDay && latestDay !== dayKey && (
            <button
              onClick={() => onDayChange(latestDay)}
              className="mt-3 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-600 transition hover:bg-blue-100"
            >
              마지막 주문일({formatDayLabel(latestDay)})로 이동 →
            </button>
          )}
        </div>
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
        * 매출은 할인까지 반영된 실제 받은 금액 기준이며, 대기/완료 상태와 무관하게
        모두 포함합니다.
      </p>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold ${accent ? "text-blue-600" : "text-gray-900"}`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// ------------------------------------------------------------
// 주문 한 건
// ------------------------------------------------------------
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
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500">
            #{seq}
          </span>
          <span className="truncate font-bold text-gray-900">{order.customer_name}</span>
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
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
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
