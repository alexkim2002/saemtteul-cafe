"use client";

import { useMemo, useRef, useState } from "react";
import { MenuItem, favoriteItems, orderedCategories } from "@/data/menu";
import {
  ACCOUNT_HOLDER,
  BANK_ACCOUNT,
  BANK_NAME,
  TUMBLER_DISCOUNT,
} from "@/lib/config";
import { insertOrder, nextOrderLabel } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";
import {
  OrderItem,
  PaymentMethod,
  formatPrice,
  itemsTotal,
  tumblerCount,
} from "@/lib/types";

type CartLine = OrderItem;

/** 즐겨찾기 칩 이름 (카테고리 이름과 겹치지 않게 이모지를 붙여 둡니다) */
const FAVORITE_TAB = "⭐ 자주 쓰는";
const ALL_TAB = "전체";

/** 같은 메뉴 + 같은 온도 + 같은 텀블러 여부면 한 줄로 합칩니다 */
function cartLineKey(line: CartLine): string {
  return `${line.menuId}|${line.temperature}|${line.tumbler ? "T" : "N"}`;
}

/** 한 줄에 붙는 텀블러 할인액 (잔 수만큼, 음료값을 넘지 않게) */
function lineDiscount(line: CartLine): number {
  if (!line.tumbler) return 0;
  return Math.min(TUMBLER_DISCOUNT * line.quantity, line.unitPrice * line.quantity);
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
  const [tab, setTab] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // null이면 "장바구니가 비면 접고, 담기면 편다" 기본 동작
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  // setSaving은 다음 렌더에야 반영됩니다. 느린 폰에서 연타하면 두 건이
  // 저장될 수 있어, 즉시 막히는 ref로 한 번 더 잠급니다.
  const payingRef = useRef(false);

  const favorites = useMemo(() => favoriteItems(menu), [menu]);
  const tabs = useMemo(
    () => [
      ...(favorites.length > 0 ? [FAVORITE_TAB] : []),
      ALL_TAB,
      ...orderedCategories(menu),
    ],
    [favorites, menu]
  );

  // 선택한 칩이 사라졌으면(메뉴 수정 등) 기본 칩으로 되돌립니다
  const activeTab =
    tab && tabs.includes(tab) ? tab : favorites.length > 0 ? FAVORITE_TAB : ALL_TAB;

  const visible = useMemo(() => {
    if (activeTab === FAVORITE_TAB) return favorites;
    if (activeTab === ALL_TAB) return menu;
    return menu.filter((m) => m.category === activeTab);
  }, [activeTab, favorites, menu]);

  const subtotal = itemsTotal(cart);
  const discount = cart.reduce((sum, l) => sum + lineDiscount(l), 0);
  const total = subtotal - discount;
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const expanded = manualOpen ?? cart.length > 0;

  function addItem(item: MenuItem, temperature: "HOT" | "ICE" | null) {
    setError(null);
    const line: CartLine = {
      menuId: item.id,
      name: item.name,
      temperature,
      quantity: 1,
      unitPrice: item.price,
      tumbler: false,
    };
    setCart((prev) => mergeLine(prev, line));
  }

  /** 이미 담긴 줄과 키가 같으면 수량을 더하고, 없으면 새 줄로 붙입니다 */
  function mergeLine(lines: CartLine[], line: CartLine): CartLine[] {
    const key = cartLineKey(line);
    const found = lines.find((l) => cartLineKey(l) === key);
    if (!found) return [...lines, line];
    return lines.map((l) =>
      cartLineKey(l) === key ? { ...l, quantity: l.quantity + line.quantity } : l
    );
  }

  function changeQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (cartLineKey(l) === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  /** 줄 단위 텀블러 토글 — 손님마다 텀블러 여부가 다를 수 있어 항목별로 답니다 */
  function toggleTumbler(key: string) {
    setCart((prev) => {
      const target = prev.find((l) => cartLineKey(l) === key);
      if (!target) return prev;
      const rest = prev.filter((l) => cartLineKey(l) !== key);
      return mergeLine(rest, { ...target, tumbler: !target.tumbler });
    });
  }

  function clearCart() {
    setCart([]);
    setCustomerName("");
    setManualOpen(null);
    setError(null);
  }

  /** 결제 = 매출 기록. 버튼 한 번으로 주문이 "완료" 상태로 저장됩니다. */
  async function pay(method: PaymentMethod) {
    if (cart.length === 0 || payingRef.current) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase 설정이 없습니다. .env.local을 확인해 주세요.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("인터넷이 끊겨 있어 저장할 수 없습니다. 연결을 확인해 주세요.");
      return;
    }

    payingRef.current = true;
    setError(null);
    setSaving(true);

    let result: { error?: string; legacySchema?: boolean };
    try {
      const typed = customerName.trim();
      const label = typed || (await nextOrderLabel(supabase));
      const tumblers = tumblerCount(cart);
      result = await insertOrder(supabase, {
        customerName: label,
        items: cart,
        total,
        discount,
        paymentMethod: method,
        memo:
          tumblers > 0 ? `텀블러 ${tumblers}잔 (−${formatPrice(discount)})` : null,
        status: "완료",
      });
      if (!result.error) {
        setReceipt({ label, method, items: cart, discount, total });
      }
    } catch (e) {
      // 네트워크가 끊기면 supabase-js가 예외를 던지기도 합니다
      result = { error: e instanceof Error ? e.message : "연결에 실패했습니다" };
    } finally {
      payingRef.current = false;
      setSaving(false);
    }

    if (result.error) {
      setError(
        `주문 저장 실패: ${result.error} — 주문서는 그대로 두었으니 다시 눌러 주세요.`
      );
      return;
    }
    // 컬럼이 없어 메모로 우회 저장된 경우는 화면 상단 배너가 계속 알려줍니다
    clearCart();
    onOrderSaved();
  }

  return (
    <section className="lg:grid lg:grid-cols-[1fr_21rem] lg:gap-4 xl:grid-cols-[1fr_23rem]">
      {/* ---------------- 메뉴 버튼판 ---------------- */}
      <div className={expanded ? "pb-[19rem] lg:pb-0" : "pb-24 lg:pb-0"}>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`h-11 shrink-0 rounded-full px-4 text-sm font-bold transition ${
                activeTab === c
                  ? "bg-forest text-white shadow-sm"
                  : "bg-paper text-ink-soft ring-1 ring-line hover:bg-forest-soft"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {menuLoading ? (
          <p className="py-20 text-center text-ink-faint">메뉴를 불러오는 중...</p>
        ) : visible.length === 0 ? (
          <p className="py-20 text-center text-sm text-ink-faint">
            {activeTab === FAVORITE_TAB
              ? "즐겨찾기가 비어 있어요. 메뉴 탭에서 ⭐를 눌러 자주 나가는 메뉴를 등록해 보세요."
              : "등록된 메뉴가 없습니다. 메뉴 탭에서 추가해 주세요."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <MenuTile key={item.id} item={item} onAdd={addItem} />
            ))}
          </div>
        )}
      </div>

      {/* ---------------- 주문서 (모바일: 하단 시트 / 데스크톱: 오른쪽 고정) ---------------- */}
      <aside className="fixed inset-x-0 bottom-0 z-20 lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-4 lg:self-start">
        <div className="rounded-t-3xl bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:rounded-3xl lg:pb-4 lg:shadow-sm">
          {/* 시트 손잡이 (모바일에서 접었다 펴기) */}
          <button
            onClick={() => setManualOpen(!expanded)}
            className="mb-1 flex h-11 w-full items-center justify-between lg:pointer-events-none"
          >
            <span className="flex items-center gap-1.5 font-bold text-ink">
              주문서
              {itemCount > 0 && (
                <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-bold text-white">
                  {itemCount}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {!expanded && total > 0 && (
                <span className="font-bold text-ink">{formatPrice(total)}</span>
              )}
              <span className="text-ink-faint lg:hidden">{expanded ? "▾" : "▴"}</span>
            </span>
          </button>

          <div className={expanded ? "block" : "hidden"}>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                메뉴를 눌러 담아 주세요
              </p>
            ) : (
              <>
                <ul className="mb-2 max-h-[34vh] space-y-1.5 overflow-y-auto lg:max-h-[42vh]">
                  {cart.map((line) => {
                    const key = cartLineKey(line);
                    const lineTotal = line.unitPrice * line.quantity - lineDiscount(line);
                    return (
                      // 한 줄에 다 넣으면 휴대폰에서 이름이 잘리고 버튼이 작아집니다.
                      // 위: 이름·금액 / 아래: 44px 버튼들 — 두 줄로 나눕니다.
                      <li key={key} className="rounded-xl bg-cream px-2.5 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className="font-semibold text-ink">{line.name}</span>
                            {line.temperature && (
                              <span
                                className={`ml-1 text-xs font-bold ${
                                  line.temperature === "HOT" ? "text-sun-deep" : "text-ice"
                                }`}
                              >
                                {line.temperature}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-ink">
                            {formatPrice(lineTotal)}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between">
                          <button
                            onClick={() => toggleTumbler(key)}
                            aria-label="텀블러 지참"
                            aria-pressed={line.tumbler ?? false}
                            title={`텀블러 지참 (잔당 −${formatPrice(TUMBLER_DISCOUNT)})`}
                            className={`flex h-11 items-center gap-1 rounded-xl border-2 px-2.5 text-sm font-bold transition ${
                              line.tumbler
                                ? "border-forest bg-forest text-white"
                                : "border-forest-mid bg-paper text-forest hover:bg-forest-soft"
                            }`}
                          >
                            🥤
                            <span className="text-xs">
                              {line.tumbler ? "할인 중" : "텀블러"}
                            </span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => changeQuantity(key, -1)}
                              aria-label="수량 감소"
                              className="h-11 w-11 rounded-xl bg-brown-soft text-xl font-semibold leading-none text-ink-soft transition hover:bg-line"
                            >
                              −
                            </button>
                            <span className="w-7 text-center text-base font-bold text-ink">
                              {line.quantity}
                            </span>
                            <button
                              onClick={() => changeQuantity(key, 1)}
                              aria-label="수량 증가"
                              className="h-11 w-11 rounded-xl bg-brown-soft text-xl font-semibold leading-none text-ink-soft transition hover:bg-line"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mb-2 rounded-xl bg-forest-soft px-3 py-2 text-xs font-semibold text-forest-deep">
                  텀블러 가져온 음료는 🥤를 눌러주세요 — 그 음료만{" "}
                  {formatPrice(TUMBLER_DISCOUNT)} 할인됩니다.
                </p>
              </>
            )}

            <div className="mb-2 flex gap-2">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="이름 (선택 · 비우면 번호로 저장)"
                className="h-11 min-w-0 flex-1 rounded-xl bg-brown-soft px-3.5 text-sm text-ink placeholder:text-ink-faint focus:bg-paper focus:outline-none focus:ring-2 focus:ring-forest"
              />
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="h-11 shrink-0 rounded-xl bg-brown-soft px-3 text-xs font-semibold text-ink-soft transition hover:bg-clay-soft hover:text-clay"
                >
                  비우기
                </button>
              )}
            </div>

            <div className="mb-2.5 border-t border-line pt-2.5">
              {discount > 0 && (
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">
                    할인 전 {formatPrice(subtotal)} · 텀블러 {tumblerCount(cart)}잔
                  </span>
                  <span className="font-bold text-forest">
                    −{formatPrice(discount)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-ink-soft">받을 금액</span>
                <span className="text-2xl font-bold text-ink">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {error && (
              <p className="mb-2 rounded-xl bg-clay-soft px-3 py-2 text-sm text-clay">
                {error}
              </p>
            )}
          </div>

          {/* 결제 버튼은 접어도 항상 보입니다 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => pay("계좌이체")}
              disabled={saving || cart.length === 0}
              className="rounded-2xl bg-forest py-3.5 font-bold text-white transition hover:bg-forest-deep active:scale-[0.98] disabled:bg-line disabled:text-ink-faint"
            >
              {saving ? "저장 중..." : "계좌이체"}
            </button>
            <button
              onClick={() => pay("현금")}
              disabled={saving || cart.length === 0}
              className="rounded-2xl bg-brown py-3.5 font-bold text-white transition hover:bg-brown-deep active:scale-[0.98] disabled:bg-line disabled:text-ink-faint"
            >
              {saving ? "저장 중..." : "현금"}
            </button>
          </div>
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
  // 세 종류(품절/단일/온도선택) 모두 같은 높이·같은 자리에 이름·가격이 오도록 맞춥니다
  const tile =
    "flex h-[7.25rem] select-none flex-col justify-between rounded-2xl bg-paper p-3 shadow-sm ring-1 ring-line";

  function header(muted = false) {
    return (
      <div className="flex items-start justify-between gap-1">
        <span
          className={`font-bold leading-snug ${
            muted ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {item.name}
        </span>
        <span
          className={`shrink-0 text-xs font-bold ${
            muted ? "text-ink-faint" : "text-ink-soft"
          }`}
        >
          {formatPrice(item.price)}
        </span>
      </div>
    );
  }

  if (item.soldOut) {
    return (
      <div className={`${tile} opacity-70`}>
        {header(true)}
        <div className="flex h-11 items-center justify-center rounded-xl bg-clay-soft text-sm font-bold text-clay">
          품절
        </div>
      </div>
    );
  }

  if (!item.hasTemperature) {
    return (
      <button
        onClick={() => onAdd(item, null)}
        className={`${tile} text-left transition hover:bg-forest-soft active:scale-[0.97]`}
      >
        {header()}
        <span className="flex h-11 items-center justify-center rounded-xl bg-forest-soft text-sm font-bold text-forest">
          담기
        </span>
      </button>
    );
  }

  return (
    <div className={tile}>
      {header()}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onAdd(item, "HOT")}
          className="h-11 rounded-xl bg-sun-soft text-sm font-bold text-sun-deep transition hover:bg-sun/30 active:scale-95"
        >
          HOT
        </button>
        <button
          onClick={() => onAdd(item, "ICE")}
          className="h-11 rounded-xl bg-ice-soft text-sm font-bold text-ice transition hover:bg-ice/20 active:scale-95"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-paper p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest-soft text-3xl">
          ✅
        </div>
        <h3 className="mt-4 text-xl font-bold text-ink">
          {receipt.label} · 결제 완료
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {receipt.method} {formatPrice(receipt.total)}
          {receipt.discount > 0 && ` (텀블러 −${formatPrice(receipt.discount)})`}
        </p>

        <ul className="mt-4 space-y-1 rounded-2xl bg-cream p-4 text-left text-sm text-ink-soft">
          {receipt.items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {item.name}
                {item.temperature && ` (${item.temperature})`} x{item.quantity}
                {item.tumbler && " 🥤"}
              </span>
              <span className="font-semibold text-ink">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {receipt.method === "계좌이체" && (
          <div className="mt-3 rounded-2xl bg-forest-soft p-4 text-left">
            <div className="text-xs font-bold text-forest">계좌이체 안내</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div>
                <div className="font-bold tracking-wide text-ink">
                  {BANK_NAME} {BANK_ACCOUNT}
                </div>
                <div className="text-xs text-ink-soft">예금주: {ACCOUNT_HOLDER}</div>
              </div>
              <button
                onClick={copyAccount}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white transition ${
                  copied ? "bg-forest" : "bg-forest hover:bg-forest-deep"
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
          className="mt-5 w-full rounded-2xl bg-forest py-4 font-bold text-white transition hover:bg-forest-deep active:scale-[0.98]"
        >
          다음 주문
        </button>
      </div>
    </div>
  );
}
