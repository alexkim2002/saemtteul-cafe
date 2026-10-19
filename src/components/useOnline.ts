"use client";

import { useEffect, useState } from "react";

/**
 * 인터넷 연결 여부. 교회 지하 카운터처럼 신호가 약한 곳에서
 * 결제를 눌렀는데 조용히 실패하는 일을 막으려고 미리 알려 줍니다.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
