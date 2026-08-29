"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MenuTab from "@/components/admin/MenuTab";
import OrdersTab from "@/components/admin/OrdersTab";
import PosTab from "@/components/admin/PosTab";
import SalesTab from "@/components/admin/SalesTab";
import { MenuItem } from "@/data/menu";
import { dayKeyOf } from "@/lib/date";
import { fetchMenu } from "@/lib/menu";
import { getSupabase } from "@/lib/supabase";

type AdminTab = "pos" | "orders" | "sales" | "menu";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "pos", label: "주문받기" },
  { key: "orders", label: "주문내역" },
  { key: "sales", label: "매출" },
  { key: "menu", label: "메뉴" },
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

  return <PosShell onLogout={logout} />;
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold text-blue-500">✝️ 봉원교회 샘뜰 카페</p>
        <h1 className="mt-1 mb-6 text-2xl font-bold text-gray-900">포스 로그인</h1>
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
            className="w-full rounded-xl bg-gray-100 px-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-blue-500 py-3.5 font-bold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "확인 중..." : "입장"}
          </button>
        </form>
      </div>
    </main>
  );
}

// ------------------------------------------------------------
// 포스 셸: 탭 전환 + 공용 메뉴 상태
// ------------------------------------------------------------
function PosShell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("pos");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuFromDb, setMenuFromDb] = useState(false);
  // POS에서 결제가 끝나면 올려서 주문내역/매출을 다시 불러오게 합니다
  const [refreshKey, setRefreshKey] = useState(0);
  // 주문내역이 보고 있는 날짜 (매출 달력에서 넘어올 수 있게 셸이 들고 있습니다)
  const [historyDay, setHistoryDay] = useState(() => dayKeyOf(new Date()));

  const supabase = useMemo(() => getSupabase(), []);

  const refreshMenu = useCallback(async () => {
    const result = await fetchMenu(supabase);
    setMenu(result.items);
    setMenuFromDb(result.fromDb);
    setMenuLoading(false);
  }, [supabase]);

  useEffect(() => {
    // setState는 fetch 완료 후 비동기 콜백에서 실행됨 (동기 렌더 연쇄 없음)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshMenu();
  }, [refreshMenu]);

  if (!supabase) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20 text-center text-gray-600">
        <p className="text-lg font-semibold">⚠️ Supabase 설정이 없습니다.</p>
        <p className="mt-2 text-sm">
          프로젝트 루트에 <code>.env.local</code> 파일을 만들고 값을 채운 뒤 dev
          서버를 재시작하세요. (README 참고)
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 pb-6 sm:px-4 sm:py-5">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-500">✝️ 봉원교회 샘뜰 카페</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              포스
            </h1>
          </div>
          <button
            onClick={onLogout}
            className="rounded-xl bg-gray-100 px-3.5 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-200"
          >
            로그아웃
          </button>
        </div>
        <nav className="mt-3 flex rounded-2xl bg-gray-200/60 p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                tab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* 탭을 옮겨도 담아둔 주문서가 날아가지 않도록 POS는 숨기기만 합니다 */}
      <div className={tab === "pos" ? "" : "hidden"}>
        <PosTab
          menu={menu}
          menuLoading={menuLoading}
          onOrderSaved={() => setRefreshKey((k) => k + 1)}
        />
      </div>
      {tab === "orders" && (
        <OrdersTab
          refreshKey={refreshKey}
          dayKey={historyDay}
          onDayChange={setHistoryDay}
        />
      )}
      {tab === "sales" && (
        <SalesTab
          refreshKey={refreshKey}
          onOpenDay={(day) => {
            setHistoryDay(day);
            setTab("orders");
          }}
        />
      )}
      {tab === "menu" && (
        <MenuTab menu={menu} fromDb={menuFromDb} onChanged={refreshMenu} />
      )}
    </main>
  );
}
