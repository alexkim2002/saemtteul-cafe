"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MENU, SIZE_UPCHARGE } from "@/data/menu";
import { getSupabase } from "@/lib/supabase";
import {
  Order,
  OrderItem,
  OrderStatus,
  ORDER_STATUSES,
  formatOrderItem,
  formatPrice,
} from "@/lib/types";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "samteul1234";
const AUTH_KEY = "samteul-admin-auth";

const STATUS_STYLE: Record<OrderStatus, string> = {
  대기: "bg-red-100 text-red-700 border-red-300",
  준비중: "bg-yellow-100 text-yellow-800 border-yellow-300",
  완료: "bg-green-100 text-green-700 border-green-300",
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  대기: "준비중",
  준비중: "완료",
  완료: null,
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(AUTH_KEY) === "true");
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!authed) {
    return (
      <LoginForm
        onSuccess={() => {
          sessionStorage.setItem(AUTH_KEY, "true");
          setAuthed(true);
        }}
      />
    );
  }

  return <Dashboard />;
}

// ------------------------------------------------------------
// 로그인
// ------------------------------------------------------------
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-2xl font-bold text-amber-900">
        🔒 샘뜰 카페 관리자
      </h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="비밀번호"
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-amber-500 focus:outline-none"
        />
        {error && (
          <p className="text-sm text-red-600">비밀번호가 올바르지 않습니다.</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-amber-700 py-3 font-bold text-white hover:bg-amber-800"
        >
          입장
        </button>
      </form>
    </main>
  );
}

// ------------------------------------------------------------
// 주문 대시보드
// ------------------------------------------------------------
function Dashboard() {
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
    if (!supabase) {
      setLoading(false);
      return;
    }
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

  const filtered =
    filter === "전체" ? orders : orders.filter((o) => o.status === filter);
  const pendingCount = orders.filter((o) => o.status === "대기").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-900">📋 주문 관리</h1>
          <p className="text-sm text-gray-500">
            대기 중 주문 <span className="font-bold text-red-600">{pendingCount}</span>건
            · 실시간 자동 갱신
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800"
        >
          + 수동 주문
        </button>
      </header>

      {/* 상태 필터 */}
      <div className="mb-4 flex gap-2">
        {(["전체", ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filter === s
                ? "border-amber-700 bg-amber-700 text-white"
                : "border-gray-300 bg-white text-gray-600"
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
            <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
          ))}
        </ul>
      )}

      {showAddForm && (
        <ManualOrderModal
          onClose={() => setShowAddForm(false)}
          onAdded={() => {
            setShowAddForm(false);
            fetchOrders();
          }}
        />
      )}
    </main>
  );
}

// ------------------------------------------------------------
// 주문 카드
// ------------------------------------------------------------
function OrderCard({
  order,
  onUpdateStatus,
}: {
  order: Order;
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
}) {
  const next = NEXT_STATUS[order.status];
  const time = new Date(order.created_at).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[order.status]}`}
          >
            {order.status}
          </span>
          <span className="font-bold">{order.customer_name}</span>
          {order.phone && (
            <span className="text-sm text-gray-500">{order.phone}</span>
          )}
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
        <span className="font-bold text-amber-800">{formatPrice(order.total)}</span>
        <div className="flex gap-2">
          {/* 상태 직접 선택 */}
          <select
            value={order.status}
            onChange={(e) => onUpdateStatus(order, e.target.value as OrderStatus)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
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
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-800"
            >
              {next}(으)로 →
            </button>
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
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 항목 추가 폼 상태
  const [menuId, setMenuId] = useState(MENU[0].id);
  const [temperature, setTemperature] = useState<"HOT" | "ICE">("HOT");
  const [size, setSize] = useState<"Regular" | "Large">("Regular");
  const [quantity, setQuantity] = useState(1);

  const menu = MENU.find((m) => m.id === menuId)!;
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  function addItem() {
    const unitPrice =
      menu.price + (menu.hasSize && size === "Large" ? SIZE_UPCHARGE : 0);
    setItems((prev) => [
      ...prev,
      {
        menuId: menu.id,
        name: menu.name,
        temperature: menu.hasTemperature ? temperature : null,
        size: menu.hasSize ? size : null,
        quantity,
        unitPrice,
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
      phone: phone.trim(),
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">수동 주문 추가</h3>

        <div className="mb-3 flex gap-2">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="주문자 이름 *"
            className="w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="연락처 (선택)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {/* 항목 추가 */}
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <select
            value={menuId}
            onChange={(e) => setMenuId(e.target.value)}
            className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            {MENU.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({formatPrice(m.price)})
              </option>
            ))}
          </select>

          <div className="mb-2 flex gap-2">
            {menu.hasTemperature && (
              <select
                value={temperature}
                onChange={(e) => setTemperature(e.target.value as "HOT" | "ICE")}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="HOT">HOT</option>
                <option value="ICE">ICE</option>
              </select>
            )}
            {menu.hasSize && (
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as "Regular" | "Large")}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="Regular">Regular</option>
                <option value="Large">Large (+{SIZE_UPCHARGE}원)</option>
              </select>
            )}
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
            />
          </div>

          <button
            onClick={addItem}
            className="w-full rounded-lg border border-amber-700 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50"
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
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 rounded-xl border border-gray-300 py-3 font-semibold text-gray-600"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-amber-700 py-3 font-bold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "주문 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
