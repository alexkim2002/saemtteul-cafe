"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItem, orderedCategories } from "@/data/menu";
import {
  ACCOUNT_HOLDER,
  BANK_ACCOUNT,
  BANK_NAME,
  TUMBLER_DISCOUNT,
} from "@/lib/config";
import { insertOrder, nextOrderLabel } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";
import { OrderItem, PaymentMethod, formatPrice, itemsTotal } from "@/lib/types";

type CartLine = OrderItem;

/** 같은 메뉴 + 같은 온도면 한 줄로 합칩니다 */
function cartLineKey(line: CartLine): string {
  return `${line.menuId}|${line.temperature}`;
}

interface Receipt {
  label: string;
  method: PaymentMethod;
  items: CartLine[];
  discount: number;
  total: number;
}

export default function PosTab({
  menu,
  menuLoading,
  onOrderSaved,
}: {
  menu: MenuItem[];
  menuLoading: boolean;
  onOrderSaved: () => void;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string>("전체");
  const [customerName, setCustomerName] = useState("");
  const [memo, setMemo] = useState("");
  const [bringTumbler, setBringTumbler] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const categories = useMemo(() => ["전체", ...orderedCategories(menu)], [menu]);
  const visible = useMemo(
    () => (category === "전체" ? menu : menu.filter((m) => m.category === category)),
    [menu, category]
  );

  // 메뉴가 바뀌어 선택한 카테고리가 사라지면 "전체"로 되돌립니다
  useEffect(() => {
    if (!categories.includes(category)) setCategory("전체");
  }, [categories, category]);

  const subtotal = itemsTotal(cart);
  const discount =
    bringTumbler && cart.length > 0 ? Math.min(TUMBLER_DISCOUNT, subtotal) : 0;
  const total = subtotal - discount;
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  function addItem(item: MenuItem, temperature: "HOT" | "ICE" | null) {
    setError(null);
    const line: CartLine = {
      menuId: item.id,
      name: item.name,
      temperature,
      quantity: 1,
      unitPrice: item.price,
    };
    setCart((prev) => {
      const key = cartLineKey(line);
      const found = prev.find((l) => cartLineKey(l) === key);
      if (found) {
        return prev.map((l) =>
          cartLineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, line];
    });
  }

  function changeQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (cartLineKey(l) === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setBringTumbler(false);
    setCustomerName("");
    setMemo("");
    setError(null);
  }

  /** 결제 = 매출 기록. 버튼 한 번으로 주문이 "완료" 상태로 저장됩니다. */
  async function pay(method: PaymentMethod) {
    if (cart.length === 0 || saving) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase 설정이 없습니다. .env.local을 확인해 주세요.");
      return;
    }

    setError(null);
    setSaving(true);
    const typed = customerName.trim();
    const label = typed || (await nextOrderLabel(supabase));
    const result = await insertOrder(supabase, {
      customerName: label,
      items: cart,
      total,
      discount,
      paymentMethod: method,
      memo:
        [memo.trim(), discount > 0 ? `텀블러 할인 -${formatPrice(discount)}` : ""]
          .filter(Boolean)
          .join(" · ") || null,
      status: "완료",
    });
    setSaving(false);

    if (result.error) {
      setError(`주문 저장 실패: ${result.error}`);
      return;
    }
    setNotice(
      result.legacySchema
        ? "결제수단/할인 컬럼이 아직 없어 메모에만 기록했습니다. Supabase SQL Editor에서 supabase/schema.sql을 다시 실행해 주세요."
        : null
    );
    setReceipt({ label, method, items: cart, discount, total });
    clearCart();
    onOrderSaved();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
      {/* ---------------- 왼쪽: 메뉴 버튼판 ---------------- */}
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                category === c
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-500 shadow-sm hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {menuLoading ? (
          <p className="py-20 text-center text-gray-400">메뉴를 불러오는 중...</p>
        ) : visible.length === 0 ? (
          <p className="py-20 text-center text-gray-400">
            등록된 메뉴가 없습니다. &apos;메뉴&apos; 탭에서 추가해 주세요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <MenuTile key={item.id} item={item} onAdd={addItem} />
            ))}
          </div>
        )}
      </div>

      {/* ---------------- 오른쪽: 주문서 ---------------- */}
      <aside className="sticky bottom-0 z-10 self-start lg:bottom-auto lg:top-4">
        <div className="rounded-3xl bg-white p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">
              주문서
              {itemCount > 0 && (
                <span className="ml-1.5 text-sm font-semibold text-blue-500">
                  {itemCount}개
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-red-500"
              >
                전체 비우기
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              메뉴를 눌러 담아 주세요
            </p>
          ) : (
            <ul className="mb-3 max-h-56 space-y-2 overflow-y-auto lg:max-h-[46vh]">
              {cart.map((line) => {
                const key = cartLineKey(line);
                return (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-gray-900">{line.name}</span>
                      {line.temperature && (
                        <span
                          className={`ml-1 text-xs font-bold ${
                            line.temperature === "HOT" ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {line.temperature}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => changeQuantity(key, -1)}
                      aria-label="수량 감소"
                      className="h-8 w-8 shrink-0 rounded-lg bg-gray-100 text-lg font-semibold leading-none text-gray-600 transition hover:bg-gray-200"
                    >
                      −
                    </button>
                    <span className="w-5 shrink-0 text-center font-bold text-gray-900">
                      {line.quantity}
                    </span>
                    <button
                      onClick={() => changeQuantity(key, 1)}
                      aria-label="수량 증가"
                      className="h-8 w-8 shrink-0 rounded-lg bg-gray-100 text-lg font-semibold leading-none text-gray-600 transition hover:bg-gray-200"
                    >
                      +
                    </button>
                    <span className="w-16 shrink-0 text-right font-semibold text-gray-900">
                      {formatPrice(line.unitPrice * line.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 텀블러 할인 */}
          <button
            onClick={() => setBringTumbler((v) => !v)}
            className={`mb-2 flex w-full items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${
              bringTumbler ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold text-gray-900">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white transition ${
                  bringTumbler ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                ✓
              </span>
              🥤 텀블러 지참
            </span>
            <span
              className={`font-bold ${bringTumbler ? "text-blue-600" : "text-gray-400"}`}
            >
              −{formatPrice(TUMBLER_DISCOUNT)}
            </span>
          </button>

          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="주문자 이름 (비우면 번호로 저장)"
            className="mb-2 w-full rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택 · 예: 샷 추가)"
            className="mb-3 w-full rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 합계 */}
          <div className="mb-3 border-t border-gray-100 pt-3">
            {discount > 0 && (
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-500">할인 전 {formatPrice(subtotal)}</span>
                <span className="font-bold text-blue-600">−{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-gray-500">받을 금액</span>
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          {error && (
            <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {notice && (
            <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {notice}
            </p>
          )}

          {/* 결제 = 매출 기록 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => pay("계좌이체")}
              disabled={saving || cart.length === 0}
              className="rounded-2xl bg-blue-500 py-4 font-bold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
            >
              계좌이체
            </button>
            <button
              onClick={() => pay("현금")}
              disabled={saving || cart.length === 0}
              className="rounded-2xl bg-gray-900 py-4 font-bold text-white transition hover:bg-gray-800 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
            >
              현금
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            {saving ? "저장 중..." : "결제 버튼을 누르면 바로 매출로 기록됩니다"}
          </p>
        </div>
      </aside>

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </section>
  );
}

// ------------------------------------------------------------
// 메뉴 버튼 — HOT/ICE 메뉴는 한 번의 터치로 온도까지 선택됩니다
// ------------------------------------------------------------
function MenuTile({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem, temperature: "HOT" | "ICE" | null) => void;
}) {
  if (item.soldOut) {
    return (
      <div className="flex min-h-28 select-none flex-col justify-between rounded-2xl bg-white p-3 opacity-50 shadow-sm">
        <div>
          <div className="font-bold text-gray-400 line-through">{item.name}</div>
          <div className="mt-0.5 text-xs font-bold text-red-400">품절</div>
        </div>
        <div className="text-right text-sm font-bold text-gray-400">
          {formatPrice(item.price)}
        </div>
      </div>
    );
  }

  if (!item.hasTemperature) {
    return (
      <button
        onClick={() => onAdd(item, null)}
        className="flex min-h-28 select-none flex-col justify-between rounded-2xl bg-white p-3 text-left shadow-sm transition hover:bg-blue-50 active:scale-[0.97]"
      >
        <div className="font-bold leading-snug text-gray-900">{item.name}</div>
        <div className="text-right text-sm font-bold text-gray-900">
          {formatPrice(item.price)}
        </div>
      </button>
    );
  }

  return (
    <div className="flex min-h-28 select-none flex-col justify-between rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold leading-snug text-gray-900">{item.name}</span>
        <span className="shrink-0 text-xs font-bold text-gray-400">
          {formatPrice(item.price)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onAdd(item, "HOT")}
          className="rounded-xl bg-red-50 py-2 text-sm font-bold text-red-500 transition hover:bg-red-100 active:scale-95"
        >
          HOT
        </button>
        <button
          onClick={() => onAdd(item, "ICE")}
          className="rounded-xl bg-blue-50 py-2 text-sm font-bold text-blue-500 transition hover:bg-blue-100 active:scale-95"
        >
          ICE
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 결제 완료 화면 (계좌이체면 계좌번호도 함께 안내)
// ------------------------------------------------------------
function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyAccount() {
    try {
      // http(비보안 컨텍스트)에서는 navigator.clipboard가 없어 폴백을 사용
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(BANK_ACCOUNT);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = BANK_ACCOUNT;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-3xl">
          ✅
        </div>
        <h3 className="mt-4 text-xl font-bold text-gray-900">
          {receipt.label} · 결제 완료
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {receipt.method} {formatPrice(receipt.total)}
          {receipt.discount > 0 && ` (텀블러 −${formatPrice(receipt.discount)})`}
        </p>

        <ul className="mt-4 space-y-1 rounded-2xl bg-gray-50 p-4 text-left text-sm text-gray-600">
          {receipt.items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {item.name}
                {item.temperature && ` (${item.temperature})`} x{item.quantity}
              </span>
              <span className="font-semibold text-gray-900">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {receipt.method === "계좌이체" && (
          <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-left">
            <div className="text-xs font-bold text-blue-600">계좌이체 안내</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div>
                <div className="font-bold tracking-wide text-gray-900">
                  {BANK_NAME} {BANK_ACCOUNT}
                </div>
                <div className="text-xs text-gray-500">예금주: {ACCOUNT_HOLDER}</div>
              </div>
              <button
                onClick={copyAccount}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white transition ${
                  copied ? "bg-green-500" : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {copied ? "복사됨 ✓" : "복사"}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          autoFocus
          className="mt-5 w-full rounded-2xl bg-blue-500 py-4 font-bold text-white transition hover:bg-blue-600 active:scale-[0.98]"
        >
          다음 주문
        </button>
      </div>
    </div>
  );
}
