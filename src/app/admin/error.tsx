"use client";

import { useEffect } from "react";

/**
 * 포스 화면이 통째로 하얘지는 일을 막는 안전망입니다.
 * 영업 중에 오류가 나도 "다시 시도"로 바로 복구할 수 있게 합니다.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[포스 오류]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <div className="rounded-3xl bg-paper p-7 text-center shadow-sm ring-1 ring-line">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-clay-soft text-3xl">
          ⚠️
        </div>
        <h1 className="mt-4 text-lg font-bold text-ink">화면에 문제가 생겼어요</h1>
        <p className="mt-2 text-sm text-ink-soft">
          저장된 주문과 매출은 그대로 있습니다. 아래 버튼으로 다시 열어 주세요.
        </p>
        <button
          onClick={reset}
          className="mt-5 w-full rounded-2xl bg-forest py-4 font-bold text-white transition hover:bg-forest-deep active:scale-[0.98]"
        >
          다시 시도
        </button>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 w-full rounded-2xl bg-brown-soft py-3 text-sm font-semibold text-ink-soft transition hover:bg-line"
        >
          새로고침
        </button>
      </div>
    </main>
  );
}
