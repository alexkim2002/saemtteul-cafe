"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem, orderedCategories } from "@/data/menu";
import { fetchMenu } from "@/lib/menu";
import { getSupabase } from "@/lib/supabase";
import { OrderItem, formatPrice } from "@/lib/types";

// 장바구니 항목 (동일 메뉴+옵션이면 수량만 증가)
type CartLine = OrderItem;

// 텀블러(개인컵) 지참 시 주문당 할인 금액 (원)
const TUMBLER_DISCOUNT = 500;

// 계좌이체 안내 (결제 모듈 없이 이체로 받습니다)
const BANK_NAME = "신협";
const BANK_ACCOUNT = "131-006-066742";
const ACCOUNT_HOLDER = "봉원교회";

function cartLineKey(line: CartLine): string {
  return `${line.menuId}|${line.temperature}`;
}

export default function CustomerPage() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [bringTumbler, setBringTumbler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doneOrder, setDoneOrder] = useState<{ name: string; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMenu(getSupabase()).then((result) => setMenu(result.items));
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [cart]
  );
  const discount =
    bringTumbler && cart.length > 0 ? Math.min(TUMBLER_DISCOUNT, subtotal) : 0;
  const total = subtotal - discount;

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
      memo: bringTumbler
        ? `텀블러 지참 (-${TUMBLER_DISCOUNT.toLocaleString("ko-KR")}원 할인)`
        : null,
    });
    setSubmitting(false);

    if (dbError) {
      setError(`주문 저장에 실패했습니다: ${dbError.message}`);
      return;
    }

    setDoneOrder({ name: customerName.trim(), total });
    setCart([]);
    setCustomerName("");
    setBringTumbler(false);
  }

  // 주문 완료 화면
  if (doneOrder) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
        <div className="rounded-3xl bg-white px-6 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
            ✅
          </div>
          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            주문이 접수되었어요
          </h1>
          <p className="mt-2 text-gray-500">
            <span className="font-semibold text-gray-900">{doneOrder.name}</span>님,
            준비가 완료되면 불러드릴게요.
          </p>

          <PaymentInfo total={doneOrder.total} />

          <p className="mt-5 text-sm text-gray-400">✝️ 봉원교회 샘뜰 카페</p>
          <button
            onClick={() => setDoneOrder(null)}
            className="mt-6 w-full rounded-2xl bg-blue-500 py-4 font-bold text-white transition hover:bg-blue-600 active:scale-[0.98]"
          >
            새 주문 하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-64 pt-10">
      {/* 헤더 */}
      <header className="mb-8 px-1">
        <p className="text-sm font-semibold text-blue-500">✝️ 봉원교회</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
          샘뜰 카페
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          텀블러를 가져오시면 {formatPrice(TUMBLER_DISCOUNT)}을 할인해 드려요.
        </p>
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
            <section key={category} className="mb-7">
              <h2 className="mb-2.5 px-1 text-sm font-bold text-gray-500">
                {category}
              </h2>
              <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {items.map((item) => (
                  <li key={item.id} className="border-b border-gray-100 last:border-0">
                    <button
                      disabled={item.soldOut}
                      onClick={() => setSelected(item)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">
                          {item.name}
                          {item.soldOut && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500">
                              품절
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="mt-0.5 text-xs text-gray-400">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 font-bold text-gray-900">
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
      <div className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-2xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {cart.length > 0 && (
            <ul className="mb-3 max-h-36 space-y-2 overflow-y-auto text-sm">
              {cart.map((line) => {
                const key = cartLineKey(line);
                return (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      <span className="font-medium text-gray-900">{line.name}</span>
                      {line.temperature && (
                        <span className="text-gray-400"> · {line.temperature}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => changeQuantity(key, -1)}
                        className="h-7 w-7 rounded-lg bg-gray-100 font-semibold text-gray-600 leading-none transition hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-semibold text-gray-900">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => changeQuantity(key, 1)}
                        className="h-7 w-7 rounded-lg bg-gray-100 font-semibold text-gray-600 leading-none transition hover:bg-gray-200"
                      >
                        +
                      </button>
                      <span className="w-20 text-right font-semibold text-gray-900">
                        {formatPrice(line.unitPrice * line.quantity)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 텀블러 지참 할인 */}
          <button
            onClick={() => setBringTumbler((v) => !v)}
            className={`mb-2.5 flex w-full items-center justify-between rounded-xl border-2 px-4 py-2.5 text-left text-sm transition ${
              bringTumbler
                ? "border-blue-500 bg-blue-50"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-2.5 font-semibold text-gray-900">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white transition ${
                  bringTumbler ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                ✓
              </span>
              🥤 텀블러를 가져왔어요
            </span>
            <span
              className={`font-bold ${bringTumbler ? "text-blue-600" : "text-gray-400"}`}
            >
              −{formatPrice(TUMBLER_DISCOUNT)}
            </span>
          </button>

          {discount > 0 && (
            <div className="mb-2 flex items-center justify-between px-1 text-sm">
              <span className="text-gray-500">
                주문 금액 {formatPrice(subtotal)} · 텀블러 할인
              </span>
              <span className="font-bold text-blue-600">
                −{formatPrice(discount)}
              </span>
            </div>
          )}

          <div className="mb-2.5">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="주문자 이름"
              className="w-full rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

          <button
            onClick={submitOrder}
            disabled={submitting || cart.length === 0}
            className="w-full rounded-2xl bg-blue-500 py-4 font-bold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
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
// 주문 완료 화면의 계좌이체 안내 (계좌번호 복사 버튼 포함)
// ------------------------------------------------------------
function PaymentInfo({ total }: { total: number }) {
  const [copied, setCopied] = useState(false);

  async function copyAccount() {
    const text = BANK_ACCOUNT;
    try {
      // http(비보안 컨텍스트)에서는 navigator.clipboard가 없어 폴백을 사용
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
      // 복사가 막힌 환경에서는 화면의 계좌번호를 보고 직접 입력
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-gray-50 p-5 text-left">
      <div className="text-sm font-bold text-gray-900">
        💳 결제는 계좌이체로 부탁드려요
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-bold tracking-wide text-gray-900">
            {BANK_NAME} {BANK_ACCOUNT}
          </div>
          <div className="mt-0.5 text-sm text-gray-500">
            예금주: {ACCOUNT_HOLDER}
          </div>
        </div>
        <button
          onClick={copyAccount}
          className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white transition ${
            copied ? "bg-green-500" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {copied ? "복사 완료 ✓" : "계좌번호 복사"}
        </button>
      </div>
      <div className="mt-4 border-t border-gray-200 pt-3 text-sm text-gray-500">
        이체 금액:{" "}
        <span className="text-base font-bold text-blue-600">
          {formatPrice(total)}
        </span>
      </div>
    </div>
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
          <span className="font-bold text-gray-900">{formatPrice(item.price)}</span>
        </div>

        {item.hasTemperature && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-gray-500">온도</div>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {(["HOT", "ICE"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setTemperature(o)}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                    temperature === o
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-400"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 수량 */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">수량</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-9 w-9 rounded-xl bg-gray-100 text-lg font-semibold text-gray-600 leading-none transition hover:bg-gray-200"
            >
              −
            </button>
            <span className="w-6 text-center font-bold text-gray-900">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="h-9 w-9 rounded-xl bg-gray-100 text-lg font-semibold text-gray-600 leading-none transition hover:bg-gray-200"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 rounded-2xl bg-gray-100 py-4 font-semibold text-gray-600 transition hover:bg-gray-200"
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
            className="flex-1 rounded-2xl bg-blue-500 py-4 font-bold text-white transition hover:bg-blue-600 active:scale-[0.98]"
          >
            {formatPrice(item.price * quantity)} 담기
          </button>
        </div>
      </div>
    </div>
  );
}
