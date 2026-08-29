"use client";

import { useMemo, useState } from "react";
import { CATEGORY_ORDER, MenuItem, sortMenuItems } from "@/data/menu";
import { getSupabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/types";

// ------------------------------------------------------------
// 메뉴 탭
// ------------------------------------------------------------
export default function MenuTab({
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
      <section className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-gray-600 shadow-sm">
        <p className="text-base font-semibold text-gray-900">
          ⚠️ 메뉴 테이블(menu_items)이 아직 준비되지 않았습니다.
        </p>
        <p className="mt-2">
          Supabase 대시보드 &gt; SQL Editor에서 프로젝트의{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5">
            supabase/schema.sql
          </code>{" "}
          내용을 실행하면 메뉴 테이블이 만들어지고 기본 메뉴가 채워집니다.
        </p>
        <p className="mt-2 text-gray-400">
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
          className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600"
        >
          + 메뉴 추가
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {sortMenuItems(menu).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3.5 shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                  {item.category}
                </span>
                <span
                  className={`font-semibold ${
                    item.soldOut ? "text-gray-300 line-through" : "text-gray-900"
                  }`}
                >
                  {item.name}
                </span>
                {item.hasTemperature && (
                  <span className="text-xs text-gray-300">HOT/ICE</span>
                )}
              </div>
              {item.description && (
                <div className="mt-0.5 text-xs text-gray-400">
                  {item.description}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="w-20 text-right font-bold text-gray-900">
                {formatPrice(item.price)}
              </span>
              <button
                onClick={() => toggleSoldOut(item)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  item.soldOut
                    ? "bg-red-50 text-red-500 hover:bg-red-100"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {item.soldOut ? "품절 중" : "판매 중"}
              </button>
              <button
                onClick={() => setEditing(item)}
                className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
              >
                수정
              </button>
              <button
                onClick={() => remove(item)}
                className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-xl font-bold text-gray-900">
          {item ? "메뉴 수정" : "메뉴 추가"}
        </h3>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-500">이름 *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 아메리카노"
              className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex gap-2">
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-medium text-gray-500">카테고리</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-gray-900"
              >
                {[...new Set([...CATEGORY_ORDER, category])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-32 text-sm">
              <span className="mb-1 block font-medium text-gray-500">가격 (원)</span>
              <input
                type="number"
                min={0}
                step={100}
                value={price}
                onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-right text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-500">
              설명 (선택)
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 진한 치즈 풍미의 수제 케이크"
              className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <input
                type="checkbox"
                checked={hasTemperature}
                onChange={(e) => setHasTemperature(e.target.checked)}
                className="h-4 w-4 accent-blue-500"
              />
              HOT/ICE 선택 가능
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
              표시 순서
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-20 rounded-xl bg-gray-100 px-2 py-1.5 text-right text-gray-900"
              />
            </label>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 rounded-2xl bg-gray-100 py-3.5 font-semibold text-gray-600 transition hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-2xl bg-blue-500 py-3.5 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "저장 중..." : item ? "수정 저장" : "메뉴 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
