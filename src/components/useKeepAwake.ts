"use client";

import { useEffect } from "react";

/**
 * 포스를 켜 둔 동안 화면이 꺼지지 않게 합니다.
 * 주문 받는 중에 휴대폰이 잠기면 매번 풀어야 해서 번거롭습니다.
 * 지원하지 않는 브라우저(iOS 구버전 등)에서는 조용히 넘어갑니다.
 */
export function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const wakeLockApi = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLockApi) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const next = await wakeLockApi!.request("screen");
        if (cancelled) {
          next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch {
        // 배터리 절약 모드 등으로 거절되면 그냥 포기합니다
      }
    }

    // 다른 앱에 갔다 오면 잠금이 풀리므로 다시 겁니다
    function onVisible() {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
