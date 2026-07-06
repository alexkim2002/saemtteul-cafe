"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem, orderedCategories } from "@/data/menu";
import { fetchMenu } from "@/lib/menu";
import { getSupabase } from "@/lib/supabase";
import { OrderItem, formatPrice } from "@/lib/types";

// 장바구니 항목 (동일 메뉴+옵션이면 수량만 증가)
type CartLine = OrderItem;

function cartLineKey(line: CartLine): string {
  return `${line.menuId}|${line.temperature}`;
}

export default function CustomerPage() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneOrderName, setDoneOrderName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMenu(getSupabase()).then((result) => setMenu(result.items));
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [cart]
  );

  function addToCart(line: CartLine) {
    setCart((prev) => {
      const key = cartLineKey(line);
      const existing = prev.find((l) => cartLineKey(l) === key);
      if (existing) {
        return prev.map((l) =>
          cartLineKey(l) === key ? { ...l, quantity: l.quantity + line.quantity } : l
        );
      }
      return [...prev, line];
    });
    setSelected(null);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          cartLineKey(l) === key ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  async function submitOrder() {
    setError(null);
    if (cart.length === 0) return setError("장바구니가 비어 있습니다.");
    if (!customerName.trim()) return setError("주문자 이름을 입력해 주세요.");

    const supabase = getSupabase();
    if (!supabase) {
      return setError(
        "Supabase 설정이 없습니다. .env.local 파일을 확인해 주세요. (README 참고)"
      );
    }

    setSubmitting(true);
    const { error: dbError } = await supabase.from("orders").insert({
      customer_name: customerName.trim(),
      items: cart,
      total,
      status: "대기",
    });
    setSubmitting(false);

    if (dbError) {
      setError(`주문 저장에 실패했습니다: ${dbError.message}`);
      return;
    }

    setDoneOrderName(customerName.trim());
    setCart([]);
    setCustomerName("");
  }

  // 주문 완료 화면
  if (doneOrderName) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20">
        <div className="rounded-2xl border border-amber-100 bg-white px-6 py-12 text-center shadow-sm">
          <div className="text-5xl">✅</div>
          <h1 className="mt-4 text-2xl font-bold">주문이 접수되었습니다!</h1>
          <p className="mt-2 text-gray-600">
            <span className="font-semibold">{doneOrderName}</span>님, 준비가 완료되면
            불러드릴게요.
          </p>
          <p className="mt-4 text-sm text-amber-700/70">✝️ 봉원교회 샘뜰 카페</p>
          <button
            onClick={() => setDoneOrderName(null)}
            className="mt-8 rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            새 주문 하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-48 pt-8">
      {/* 헤더 */}
      <header className="mb-8 rounded-2xl border border-amber-100 bg-gradient-to-b from-white to-amber-50 px-6 py-7 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-amber-800">☕ 샘뜰 카페</h1>
        <p className="mt-1.5 text-sm text-amber-700/70">
          ✝️ 봉원교회 카페 · 주문하기
        </p>
        <div className="mx-auto mt-3 flex max-w-[10rem] items-center gap-2 text-amber-300">
          <span className="h-px flex-1 bg-amber-200" aria-hidden />
          <span className="text-xs" aria-hidden>✝️</span>
          <span className="h-px flex-1 bg-amber-200" aria-hidden />
        </div>
      </header>

      {/* 메뉴 목록 */}
      {menu === null ? (
        <p className="py-16 text-center text-gray-400">메뉴를 불러오는 중...</p>
      ) : menu.length === 0 ? (
        <p className="py-16 text-center text-gray-400">
          등록된 메뉴가 없습니다. 관리자 페이지에서 메뉴를 추가해 주세요.
        </p>
      ) : (
        orderedCategories(menu).map((category) => {
          const items = menu.filter((m) => m.category === category);
          return (
            <section key={category} className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-800">
                <span className="h-5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                {category}
              </h2>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      disabled={item.soldOut}
                      onClick={() => setSelected(item)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-amber-300 hover:shadow active:bg-amber-50 disabled:opacity-40"
                    >
                      <div>
                        <div className="font-semibold">
                          {item.name}
                          {item.soldOut && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500">
                              품절
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500">{item.description}</div>
                        )}
                      </div>
                      <div className="font-semibold text-amber-700">
                        {formatPrice(item.price)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {/* 옵션 선택 모달 */}
      {selected && (
        <OptionModal
          item={selected}
          onClose={() => setSelected(null)}
          onAdd={addToCart}
        />
      )}

      {/* 하단 고정: 장바구니 + 주문자 정보 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-amber-100 bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {cart.length > 0 && (
            <ul className="mb-3 max-h-36 space-y-1 overflow-y-auto text-sm">
              {cart.map((line) => {
                const key = cartLineKey(line);
                return (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {line.name}
                      {line.temperature && (
                        <span className="text-gray-500"> ({line.temperature})</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => changeQuantity(key, -1)}
                        className="h-6 w-6 rounded-md border border-amber-200 bg-amber-50 font-semibold text-amber-700 leading-none hover:bg-amber-100"
                      >
                        −
                      </button>
                      <span className="w-5 text-center">{line.quantity}</span>
                      <button
                        onClick={() => changeQuantity(key, 1)}
                        className="h-6 w-6 rounded-md border border-amber-200 bg-amber-50 font-semibold text-amber-700 leading-none hover:bg-amber-100"
                      >
                        +
                      </button>
                      <span className="w-20 text-right font-medium">
                        {formatPrice(line.unitPrice * line.quantity)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mb-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="주문자 이름"
              className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={submitOrder}
            disabled={submitting || cart.length === 0}
            className="w-full rounded-xl bg-amber-600 py-3 font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting
              ? "주문 접수 중..."
              : cart.length === 0
                ? "메뉴를 선택해 주세요"
                : `${formatPrice(total)} 주문하기`}
          </button>
        </div>
      </div>
    </main>
  );
}

// ------------------------------------------------------------
// 옵션 선택 모달 (온도 + 수량)
// ------------------------------------------------------------
function OptionModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const [temperature, setTemperature] = useState<"HOT" | "ICE">("HOT");
  const [quantity, setQuantity] = useState(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{item.name}</h3>
          <span className="font-semibold text-amber-700">{formatPrice(item.price)}</span>
        </div>

        {item.hasTemperature && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-gray-600">온도</div>
            <div className="flex gap-2">
              {(["HOT", "ICE"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setTemperature(o)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition ${
                    temperature === o
                      ? "border-amber-500 bg-amber-100 text-amber-800"
                      : "border-amber-200 text-gray-500"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 수량 */}
        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">수량</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-8 w-8 rounded-lg border border-amber-200 bg-amber-50 text-lg font-semibold text-amber-700 leading-none hover:bg-amber-100"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="h-8 w-8 rounded-lg border border-amber-200 bg-amber-50 text-lg font-semibold text-amber-700 leading-none hover:bg-amber-100"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 rounded-xl border border-amber-200 py-3 font-semibold text-gray-600 hover:bg-amber-50"
          >
            취소
          </button>
          <button
            onClick={() =>
              onAdd({
                menuId: item.id,
                name: item.name,
                temperature: item.hasTemperature ? temperature : null,
                quantity,
                unitPrice: item.price,
              })
            }
            className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white hover:bg-amber-700"
          >
            {formatPrice(item.price * quantity)} 담기
          </button>
        </div>
      </div>
    </div>
  );
}
