"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORY_ORDER, MenuItem, sortMenuItems } from "@/data/menu";
import { fetchMenu } from "@/lib/menu";
import { getSupabase } from "@/lib/supabase";
import {
  Order,
  OrderItem,
  OrderStatus,
  ORDER_STATUSES,
  formatOrderItem,
  formatPrice,
} from "@/lib/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  대기: "bg-red-100 text-red-700 border-red-300",
  완료: "bg-green-100 text-green-700 border-green-300",
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  대기: "완료",
  완료: null,
};

type AdminTab = "orders" | "sales" | "menu";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "orders", label: "📋 주문" },
  { key: "sales", label: "💰 매출" },
  { key: "menu", label: "☕ 메뉴" },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  // 서버가 httpOnly 쿠키로 세션을 확인합니다 (비밀번호는 브라우저에 노출되지 않음)
  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => setAuthed(data.authed === true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, []);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  if (!ready) return null;

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />;
  }

  return <AdminShell onLogout={logout} />;
}

// ------------------------------------------------------------
// 로그인
// ------------------------------------------------------------
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "로그인에 실패했습니다.");
      }
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-amber-800">
          ✝️ 샘뜰 카페 관리자
        </h1>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="비밀번호"
            autoFocus
            className="w-full rounded-lg border border-amber-200 px-4 py-3 focus:border-amber-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-600 py-3 font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "확인 중..." : "입장"}
          </button>
        </form>
      </div>
    </main>
  );
}

// ------------------------------------------------------------
// 관리자 셸: 탭 전환 + 공용 메뉴 상태
// ------------------------------------------------------------
function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("orders");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuFromDb, setMenuFromDb] = useState(false);

  const supabase = useMemo(() => getSupabase(), []);

  const refreshMenu = useCallback(async () => {
    const result = await fetchMenu(supabase);
    setMenu(result.items);
    setMenuFromDb(result.fromDb);
  }, [supabase]);

  useEffect(() => {
    refreshMenu();
  }, [refreshMenu]);

  if (!supabase) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center text-gray-600">
        <p className="text-lg font-semibold">⚠️ Supabase 설정이 없습니다.</p>
        <p className="mt-2 text-sm">
          프로젝트 루트에 <code>.env.local</code> 파일을 만들고 값을 채운 뒤 dev
          서버를 재시작하세요. (README 참고)
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-amber-800">✝️ 샘뜰 카페 관리자</h1>
          <button
            onClick={onLogout}
            className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-amber-50"
          >
            로그아웃
          </button>
        </div>
        <nav className="mt-4 flex gap-2">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                tab === key
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-amber-200 bg-white text-gray-600 hover:bg-amber-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "orders" && <OrdersTab menu={menu} />}
      {tab === "sales" && <SalesTab />}
      {tab === "menu" && (
        <MenuTab menu={menu} fromDb={menuFromDb} onChanged={refreshMenu} />
      )}
    </main>
  );
}

// ------------------------------------------------------------
// 주문 탭
// ------------------------------------------------------------
function OrdersTab({ menu }: { menu: MenuItem[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "전체">("전체");

  const supabase = useMemo(() => getSupabase(), []);

  const fetchOrders = useCallback(async () => {
    if (!supabase) return;
    const { data, error: dbError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (dbError) {
      setError(`주문을 불러오지 못했습니다: ${dbError.message}`);
    } else {
      setError(null);
      setOrders((data ?? []) as Order[]);
    }
    setLoading(false);
  }, [supabase]);

  // 최초 로드 + Realtime 구독 (새 주문/상태 변경 시 자동 갱신)
  useEffect(() => {
    if (!supabase) return;
    fetchOrders();

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    // Realtime이 미설정된 경우를 대비한 15초 폴링 백업
    const interval = setInterval(fetchOrders, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, fetchOrders]);

  async function updateStatus(order: Order, status: OrderStatus) {
    if (!supabase) return;
    // 화면 먼저 갱신(낙관적 업데이트), 실패 시 재조회로 복구
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status } : o))
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

  /** 오류 주문 삭제 — 매출 집계에서도 제외됩니다 */
  async function deleteOrder(order: Order) {
    if (!supabase) return;
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
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

  const filtered =
    filter === "전체" ? orders : orders.filter((o) => o.status === filter);
  const pendingCount = orders.filter((o) => o.status === "대기").length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          대기 중 주문 <span className="font-bold text-red-600">{pendingCount}</span>건
          · 실시간 자동 갱신
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700"
        >
          + 수동 주문
        </button>
      </div>

      {/* 상태 필터 */}
      <div className="mb-4 flex gap-2">
        {(["전체", ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filter === s
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-amber-200 bg-white text-gray-600 hover:bg-amber-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-gray-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-gray-400">주문이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdateStatus={updateStatus}
              onDelete={deleteOrder}
            />
          ))}
        </ul>
      )}

      {showAddForm && (
        <ManualOrderModal
          menu={menu}
          onClose={() => setShowAddForm(false)}
          onAdded={() => {
            setShowAddForm(false);
            fetchOrders();
          }}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------
// 주문 카드
// ------------------------------------------------------------
function OrderCard({
  order,
  onUpdateStatus,
  onDelete,
}: {
  order: Order;
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
  onDelete: (order: Order) => void;
}) {
  // 삭제는 실수 방지를 위해 두 번 눌러 확정 (다른 곳을 누르면 취소)
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const next = NEXT_STATUS[order.status];
  const time = new Date(order.created_at).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[order.status]}`}
          >
            {order.status}
          </span>
          <span className="font-bold">{order.customer_name}</span>
        </div>
        <span className="text-sm text-gray-400">{time}</span>
      </div>

      <ul className="mb-2 text-sm text-gray-700">
        {order.items.map((item, i) => (
          <li key={i}>· {formatOrderItem(item)}</li>
        ))}
      </ul>

      {order.memo && (
        <p className="mb-2 text-sm text-gray-500">메모: {order.memo}</p>
      )}

      <div className="flex items-center justify-between">
        <span className="font-bold text-amber-700">{formatPrice(order.total)}</span>
        <div className="flex gap-2">
          {confirmingDelete ? (
            <>
              <span className="self-center text-xs text-red-600">
                매출에서도 제외됩니다
              </span>
              <button
                onClick={() => onDelete(order)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
              >
                정말 삭제
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-amber-50"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
              {/* 상태 직접 선택 */}
              <select
                value={order.status}
                onChange={(e) => onUpdateStatus(order, e.target.value as OrderStatus)}
                className="rounded-lg border border-amber-200 px-2 py-1.5 text-sm"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {next && (
                <button
                  onClick={() => onUpdateStatus(order, next)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-700"
                >
                  {next} 처리 ✓
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// ------------------------------------------------------------
// 수동 주문 추가 모달
// ------------------------------------------------------------
function ManualOrderModal({
  menu,
  onClose,
  onAdded,
}: {
  menu: MenuItem[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [memo, setMemo] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 항목 추가 폼 상태
  const [menuId, setMenuId] = useState(menu[0]?.id ?? "");
  const [temperature, setTemperature] = useState<"HOT" | "ICE">("HOT");
  const [quantity, setQuantity] = useState(1);

  const selectedMenu = menu.find((m) => m.id === menuId);
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  function addItem() {
    if (!selectedMenu) return;
    setItems((prev) => [
      ...prev,
      {
        menuId: selectedMenu.id,
        name: selectedMenu.name,
        temperature: selectedMenu.hasTemperature ? temperature : null,
        quantity,
        unitPrice: selectedMenu.price,
      },
    ]);
    setQuantity(1);
  }

  async function save() {
    setError(null);
    if (!customerName.trim()) return setError("주문자 이름을 입력해 주세요.");
    if (items.length === 0) return setError("주문 항목을 추가해 주세요.");

    const supabase = getSupabase();
    if (!supabase) return setError("Supabase 설정이 없습니다.");

    setSaving(true);
    const { error: dbError } = await supabase.from("orders").insert({
      customer_name: customerName.trim(),
      items,
      total,
      status: "대기",
      memo: memo.trim() || null,
    });
    setSaving(false);

    if (dbError) {
      setError(`저장 실패: ${dbError.message}`);
      return;
    }
    onAdded();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">수동 주문 추가</h3>

        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="주문자 이름 *"
          className="mb-3 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />

        {/* 항목 추가 */}
        <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <select
            value={menuId}
            onChange={(e) => setMenuId(e.target.value)}
            className="mb-2 w-full rounded-lg border border-amber-200 px-2 py-2 text-sm"
          >
            {menu.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({formatPrice(m.price)}){m.soldOut ? " · 품절" : ""}
              </option>
            ))}
          </select>

          <div className="mb-2 flex gap-2">
            {selectedMenu?.hasTemperature && (
              <select
                value={temperature}
                onChange={(e) => setTemperature(e.target.value as "HOT" | "ICE")}
                className="flex-1 rounded-lg border border-amber-200 px-2 py-2 text-sm"
              >
                <option value="HOT">HOT</option>
                <option value="ICE">ICE</option>
              </select>
            )}
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-lg border border-amber-200 px-2 py-2 text-center text-sm"
            />
          </div>

          <button
            onClick={addItem}
            disabled={!selectedMenu}
            className="w-full rounded-lg border border-amber-600 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-40"
          >
            + 항목 추가
          </button>
        </div>

        {items.length > 0 && (
          <ul className="mb-3 space-y-1 text-sm">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{formatOrderItem(item)}</span>
                <span className="flex items-center gap-2">
                  <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                  <button
                    onClick={() =>
                      setItems((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="text-red-500"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
            <li className="border-t border-gray-200 pt-1 text-right font-bold">
              합계 {formatPrice(total)}
            </li>
          </ul>
        )}

        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          className="mb-3 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 rounded-xl border border-amber-200 py-3 font-semibold text-gray-600 hover:bg-amber-50"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "주문 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 매출 탭
// ------------------------------------------------------------
type SalesRange = "오늘" | "최근 7일" | "이번 달" | "전체";

const SALES_RANGES: SalesRange[] = ["오늘", "최근 7일", "이번 달", "전체"];

function rangeStart(range: SalesRange): Date | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case "오늘":
      return today;
    case "최근 7일":
      return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    case "이번 달":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "전체":
      return null;
  }
}

function SalesTab() {
  const [range, setRange] = useState<SalesRange>("오늘");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!supabase) return;
    setOrders(null);
    let query = supabase
      .from("orders")
      .select("id, created_at, total, status, items")
      .order("created_at", { ascending: false })
      .limit(1000);
    const start = rangeStart(range);
    if (start) query = query.gte("created_at", start.toISOString());

    query.then(({ data, error: dbError }) => {
      if (dbError) {
        setError(`매출을 불러오지 못했습니다: ${dbError.message}`);
        setOrders([]);
      } else {
        setError(null);
        setOrders((data ?? []) as Order[]);
      }
    });
  }, [supabase, range]);

  const stats = useMemo(() => {
    if (!orders) return null;
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    const count = orders.length;

    // 메뉴별 판매 집계 (jsonb items 기준)
    const byMenu = new Map<string, { quantity: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        const agg = byMenu.get(item.name) ?? { quantity: 0, revenue: 0 };
        agg.quantity += item.quantity;
        agg.revenue += item.unitPrice * item.quantity;
        byMenu.set(item.name, agg);
      }
    }
    const menuRows = [...byMenu.entries()]
      .map(([name, agg]) => ({ name, ...agg }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      revenue,
      count,
      average: count > 0 ? Math.round(revenue / count) : 0,
      menuRows,
    };
  }, [orders]);

  return (
    <section>
      {/* 기간 선택 */}
      <div className="mb-4 flex gap-2">
        {SALES_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              range === r
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-amber-200 bg-white text-gray-600 hover:bg-amber-50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!stats ? (
        <p className="py-16 text-center text-gray-400">불러오는 중...</p>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatCard label="총 매출" value={formatPrice(stats.revenue)} />
            <StatCard label="주문 수" value={`${stats.count}건`} />
            <StatCard label="평균 주문 금액" value={formatPrice(stats.average)} />
          </div>

          {/* 메뉴별 판매 */}
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-800">
            <span className="h-5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            메뉴별 판매
          </h2>
          {stats.menuRows.length === 0 ? (
            <p className="py-10 text-center text-gray-400">
              해당 기간 주문이 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-100 bg-amber-50/60 text-left text-gray-600">
                    <th className="px-4 py-2.5 font-semibold">메뉴</th>
                    <th className="px-4 py-2.5 text-right font-semibold">수량</th>
                    <th className="px-4 py-2.5 text-right font-semibold">매출</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.menuRows.map((row) => (
                    <tr key={row.name} className="border-b border-amber-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium">{row.name}</td>
                      <td className="px-4 py-2.5 text-right">{row.quantity}개</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-amber-700">
                        {formatPrice(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            * 모든 상태(대기/완료)의 주문을 포함하며, 최근 1,000건까지
            집계합니다.
          </p>
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-amber-800">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------
// 메뉴 탭
// ------------------------------------------------------------
function MenuTab({
  menu,
  fromDb,
  onChanged,
}: {
  menu: MenuItem[];
  fromDb: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabase(), []);

  async function toggleSoldOut(item: MenuItem) {
    if (!supabase) return;
    const { error: dbError } = await supabase
      .from("menu_items")
      .update({ sold_out: !item.soldOut })
      .eq("id", item.id);
    if (dbError) setError(`변경 실패: ${dbError.message}`);
    else {
      setError(null);
      onChanged();
    }
  }

  async function remove(item: MenuItem) {
    if (!supabase) return;
    if (!window.confirm(`'${item.name}' 메뉴를 삭제할까요?`)) return;
    const { error: dbError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", item.id);
    if (dbError) setError(`삭제 실패: ${dbError.message}`);
    else {
      setError(null);
      onChanged();
    }
  }

  if (!fromDb) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-sm text-gray-700">
        <p className="text-base font-semibold">
          ⚠️ 메뉴 테이블(menu_items)이 아직 준비되지 않았습니다.
        </p>
        <p className="mt-2">
          Supabase 대시보드 &gt; SQL Editor에서 프로젝트의{" "}
          <code className="rounded bg-white px-1.5 py-0.5">supabase/schema.sql</code>{" "}
          내용을 실행하면 메뉴 테이블이 만들어지고 기본 메뉴가 채워집니다.
        </p>
        <p className="mt-2 text-gray-500">
          그 전까지 주문 페이지는 코드에 내장된 예비 메뉴를 표시합니다.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          총 {menu.length}개 메뉴 · 수정 사항은 주문 페이지에 바로 반영됩니다
        </p>
        <button
          onClick={() => setEditing("new")}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700"
        >
          + 메뉴 추가
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {sortMenuItems(menu).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {item.category}
                </span>
                <span className={`font-semibold ${item.soldOut ? "text-gray-400 line-through" : ""}`}>
                  {item.name}
                </span>
                {item.hasTemperature && (
                  <span className="text-xs text-gray-400">HOT/ICE</span>
                )}
              </div>
              {item.description && (
                <div className="mt-0.5 text-xs text-gray-500">{item.description}</div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="w-20 text-right font-semibold text-amber-700">
                {formatPrice(item.price)}
              </span>
              <button
                onClick={() => toggleSoldOut(item)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  item.soldOut
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-amber-200 bg-white text-gray-500 hover:bg-amber-50"
                }`}
              >
                {item.soldOut ? "품절 중" : "판매 중"}
              </button>
              <button
                onClick={() => setEditing(item)}
                className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-amber-50"
              >
                수정
              </button>
              <button
                onClick={() => remove(item)}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <MenuEditModal
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------
// 메뉴 추가/수정 모달
// ------------------------------------------------------------
function MenuEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? CATEGORY_ORDER[0]);
  const [price, setPrice] = useState(item?.price ?? 0);
  const [description, setDescription] = useState(item?.description ?? "");
  const [hasTemperature, setHasTemperature] = useState(item?.hasTemperature ?? true);
  const [sortOrder, setSortOrder] = useState(item?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("메뉴 이름을 입력해 주세요.");
    if (price < 0) return setError("가격은 0원 이상이어야 합니다.");

    const supabase = getSupabase();
    if (!supabase) return setError("Supabase 설정이 없습니다.");

    const row = {
      name: name.trim(),
      category,
      price,
      description: description.trim() || null,
      has_temperature: hasTemperature,
      sort_order: sortOrder,
    };

    setSaving(true);
    const { error: dbError } = item
      ? await supabase.from("menu_items").update(row).eq("id", item.id)
      : await supabase.from("menu_items").insert(row);
    setSaving(false);

    if (dbError) {
      setError(`저장 실패: ${dbError.message}`);
      return;
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">
          {item ? "메뉴 수정" : "메뉴 추가"}
        </h3>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-600">이름 *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 아메리카노"
              className="w-full rounded-lg border border-amber-200 px-3 py-2"
            />
          </label>

          <div className="flex gap-2">
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-medium text-gray-600">카테고리</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-amber-200 px-2 py-2"
              >
                {[...new Set([...CATEGORY_ORDER, category])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-32 text-sm">
              <span className="mb-1 block font-medium text-gray-600">가격 (원)</span>
              <input
                type="number"
                min={0}
                step={100}
                value={price}
                onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-amber-200 px-3 py-2 text-right"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-600">
              설명 (선택)
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 진한 치즈 풍미의 수제 케이크"
              className="w-full rounded-lg border border-amber-200 px-3 py-2"
            />
          </label>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <input
                type="checkbox"
                checked={hasTemperature}
                onChange={(e) => setHasTemperature(e.target.checked)}
                className="h-4 w-4 accent-amber-600"
              />
              HOT/ICE 선택 가능
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
              표시 순서
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-20 rounded-lg border border-amber-200 px-2 py-1.5 text-right"
              />
            </label>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 rounded-xl border border-amber-200 py-3 font-semibold text-gray-600 hover:bg-amber-50"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : item ? "수정 저장" : "메뉴 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
