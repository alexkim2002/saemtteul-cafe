"use client";

import { useEffect, useMemo, useState } from "react";
import { dayKeyOf } from "@/lib/date";
import { menuBreakdown, methodAgg, summarizeOrders } from "@/lib/sales";
import { getSupabase } from "@/lib/supabase";
import { Order, PAYMENT_METHODS, formatPrice } from "@/lib/types";

/** 달력 칸에 들어가는 짧은 금액 표기 (예: 12,500 → "1.3만", 3,000 → "3천") */
function formatCompactWon(amount: number): string {
  if (amount >= 10000) {
    const man = amount / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만`;
  }
  if (amount >= 1000) {
    const cheon = amount / 1000;
    return `${Number.isInteger(cheon) ? cheon : cheon.toFixed(1)}천`;
  }
  return `${amount}`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function SalesTab({
  refreshKey,
  onOpenDay,
}: {
  refreshKey: number;
  /** 달력에서 고른 날짜의 주문내역으로 넘어갑니다 */
  onOpenDay: (dayKey: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0부터 시작
  const [selectedDay, setSelectedDay] = useState<string | null>(dayKeyOf(today));
  // 어떤 달의 응답인지 함께 저장해서, 달을 빠르게 바꿀 때
  // 늦게 도착한 이전 달 응답이 화면을 덮어쓰지 않게 합니다.
  const [result, setResult] = useState<{ monthKey: string; orders: Order[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabase(), []);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    supabase
      .from("orders")
      .select("*")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data, error: dbError }) => {
        if (cancelled) return;
        if (dbError) {
          setError(`매출을 불러오지 못했습니다: ${dbError.message}`);
          setResult({ monthKey: key, orders: [] });
        } else {
          setError(null);
          setResult({ monthKey: key, orders: (data ?? []) as Order[] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, year, month, refreshKey]);

  // 현재 보고 있는 달의 응답이 아직 없으면 로딩 상태
  const orders = result && result.monthKey === monthKey ? result.orders : null;

  // 일자별 매출 집계
  const dayStats = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (const order of orders ?? []) {
      const key = dayKeyOf(new Date(order.created_at));
      const agg = map.get(key) ?? { revenue: 0, count: 0 };
      agg.revenue += order.total;
      agg.count += 1;
      map.set(key, agg);
    }
    return map;
  }, [orders]);

  const monthRevenue = (orders ?? []).reduce((sum, o) => sum + o.total, 0);
  const monthCount = orders?.length ?? 0;

  // 선택한 날짜의 상세 집계 (계산은 lib/sales.ts에 있습니다)
  const dayDetail = useMemo(() => {
    if (!orders || !selectedDay) return null;
    const dayOrders = orders.filter(
      (o) => dayKeyOf(new Date(o.created_at)) === selectedDay
    );
    return {
      summary: summarizeOrders(dayOrders),
      menuRows: menuBreakdown(dayOrders),
    };
  }, [orders, selectedDay]);

  function moveMonth(delta: number) {
    const moved = new Date(year, month + delta, 1);
    setYear(moved.getFullYear());
    setMonth(moved.getMonth());
    // 이번 달로 돌아오면 오늘을, 다른 달은 선택 해제
    setSelectedDay(
      moved.getFullYear() === today.getFullYear() && moved.getMonth() === today.getMonth()
        ? dayKeyOf(today)
        : null
    );
  }

  // 달력 칸 배열 (앞쪽 빈 칸 + 1일~말일)
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayKey = dayKeyOf(today);

  const selectedLabel = selectedDay
    ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : null;

  return (
    <section>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 달력 카드 */}
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        {/* 월 이동 */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {year}년 {month + 1}월
            </div>
            {orders !== null && (
              <div className="text-xs text-gray-400">
                이달 매출{" "}
                <span className="font-bold text-blue-600">
                  {formatPrice(monthRevenue)}
                </span>{" "}
                · {monthCount}건
              </div>
            )}
          </div>
          <button
            onClick={() => moveMonth(1)}
            aria-label="다음 달"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200"
          >
            ›
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
              }
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 칸 */}
        {orders === null ? (
          <p className="py-14 text-center text-sm text-gray-400">불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const key = `${monthKey}-${String(day).padStart(2, "0")}`;
              const stat = dayStats.get(key);
              const isSelected = selectedDay === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className={`mx-auto flex h-14 w-full max-w-14 flex-col items-center justify-center rounded-2xl transition ${
                    isSelected ? "bg-blue-500" : "hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`text-sm leading-tight ${
                      isSelected
                        ? "font-bold text-white"
                        : isToday
                          ? "font-bold text-blue-600"
                          : "font-medium text-gray-700"
                    }`}
                  >
                    {day}
                  </span>
                  <span
                    className={`text-[10px] leading-tight ${
                      isSelected
                        ? "text-blue-100"
                        : stat
                          ? "font-semibold text-blue-500"
                          : "text-transparent"
                    }`}
                  >
                    {stat ? formatCompactWon(stat.revenue) : "·"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 선택한 날짜 상세 */}
      {orders !== null && (
        <div className="mt-5">
          {!selectedDay ? (
            <p className="py-8 text-center text-sm text-gray-400">
              달력에서 날짜를 누르면 그날 매출을 볼 수 있어요.
            </p>
          ) : !dayDetail ? null : (
            <>
              <h2 className="mb-3 px-1 text-sm font-bold text-gray-500">
                {selectedLabel} 매출
              </h2>

              <div className="mb-3 grid grid-cols-3 gap-3">
                <StatCard label="총 매출" value={formatPrice(dayDetail.summary.revenue)} />
                <StatCard label="주문 수" value={`${dayDetail.summary.count}건`} />
                <StatCard label="평균 주문" value={formatPrice(dayDetail.summary.average)} />
              </div>

              {/* 결제수단별 */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((m) => {
                  const agg = methodAgg(dayDetail.summary, m);
                  return (
                    <StatCard
                      key={m}
                      label={m}
                      value={formatPrice(agg.revenue)}
                      sub={`${agg.count}건`}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => onOpenDay(selectedDay)}
                className="mb-5 w-full rounded-2xl bg-white py-3 text-sm font-bold text-blue-600 shadow-sm transition hover:bg-blue-50"
              >
                이 날 주문내역 보기 →
              </button>

              {dayDetail.menuRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  이 날짜에는 주문이 없습니다.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-400">
                        <th className="px-5 py-3 font-semibold">메뉴</th>
                        <th className="px-5 py-3 text-right font-semibold">수량</th>
                        <th className="px-5 py-3 text-right font-semibold">매출</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayDetail.menuRows.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="px-5 py-3 font-medium text-gray-900">
                            {row.name}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-600">
                            {row.quantity}개
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">
                            {formatPrice(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <p className="mt-3 px-1 text-xs text-gray-400">
            * 총 매출은 할인까지 반영된 실제 받은 금액입니다. 메뉴별 매출은 할인 전
            정가 기준이라 합계가 조금 클 수 있습니다.
            {dayDetail && dayDetail.summary.discount > 0 && (
              <>
                {" "}
                (이 날 텀블러 {dayDetail.summary.tumblers}잔 · 할인 합계{" "}
                {formatPrice(dayDetail.summary.discount)})
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
